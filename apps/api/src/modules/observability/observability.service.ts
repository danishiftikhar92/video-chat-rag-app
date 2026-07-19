import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Langfuse } from 'langfuse';
import { getEnv } from '../../config/env';
import { getObservabilityConfig, type ObservabilityConfig } from './observability.config';
import type {
  ObservabilityContext,
  ObservabilityGeneration,
  ObservabilitySpan,
  RecordFeedbackParams,
  StartTraceParams,
  TokenUsage
} from './observability.types';

const noopSpan: ObservabilitySpan = { end: () => undefined };
const noopGeneration: ObservabilityGeneration = { end: () => undefined };

const createNoopContext = (traceId: string, sessionId?: string): ObservabilityContext => ({
  traceId,
  sessionId,
  startSpan: () => noopSpan,
  startGeneration: () => noopGeneration,
  event: () => undefined,
  update: () => undefined,
  end: () => undefined
});

const toLangfuseUsage = (usage?: TokenUsage) => {
  if (!usage) return undefined;
  const input = usage.promptTokens;
  const output = usage.completionTokens;
  const total =
    usage.totalTokens ??
    (typeof input === 'number' || typeof output === 'number'
      ? (input ?? 0) + (output ?? 0)
      : undefined);
  if (input === undefined && output === undefined && total === undefined) return undefined;
  return { input, output, total, unit: 'TOKENS' as const };
};

@Injectable()
export class ObservabilityService implements OnModuleDestroy {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly config: ObservabilityConfig;
  private readonly client: Langfuse | null;

  constructor() {
    this.config = getObservabilityConfig(getEnv());
    if (!this.config.enabled) {
      this.client = null;
      this.logger.log('Langfuse tracing disabled');
      return;
    }

    this.client = new Langfuse({
      publicKey: this.config.publicKey,
      secretKey: this.config.secretKey,
      baseUrl: this.config.baseUrl,
      enabled: true
    });
    this.logger.log(
      `Langfuse tracing enabled (env=${this.config.environment}${this.config.baseUrl ? `, baseUrl=${this.config.baseUrl}` : ''})`
    );
  }

  get enabled(): boolean {
    return this.config.enabled && this.client !== null;
  }

  get environment(): string {
    return this.config.environment;
  }

  startTrace(params: StartTraceParams): ObservabilityContext {
    if (!this.client) {
      return createNoopContext(
        `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        params.sessionId
      );
    }

    const tags = Array.from(
      new Set([this.config.environment, ...(params.tags ?? [])].filter(Boolean))
    );

    const trace = this.client.trace({
      name: params.name,
      input: params.input,
      sessionId: params.sessionId,
      userId: params.userId,
      metadata: {
        environment: this.config.environment,
        ...params.metadata
      },
      tags,
      environment: this.config.environment
    });

    return {
      traceId: trace.id,
      sessionId: params.sessionId,
      startSpan: (name, input, metadata) => {
        const span = trace.span({
          name,
          input,
          metadata
        });
        return {
          end: (endParams) => {
            span.update({
              output: endParams?.output,
              metadata: endParams?.metadata,
              level: endParams?.level,
              statusMessage: endParams?.statusMessage
            });
            span.end();
          }
        };
      },
      startGeneration: ({ name, model, input, metadata }) => {
        const generation = trace.generation({
          name,
          model,
          input,
          metadata
        });
        return {
          end: (endParams) => {
            generation.update({
              output: endParams?.output,
              usage: toLangfuseUsage(endParams?.usage),
              metadata: endParams?.metadata,
              level: endParams?.level,
              statusMessage: endParams?.statusMessage
            });
            generation.end();
          }
        };
      },
      event: (name, input, metadata) => {
        trace.event({ name, input, metadata });
      },
      update: ({ output, metadata, tags: extraTags }) => {
        trace.update({
          output,
          metadata,
          ...(extraTags ? { tags: Array.from(new Set([...tags, ...extraTags])) } : {})
        });
      },
      end: (endParams) => {
        trace.update({
          output: endParams?.output,
          metadata: endParams?.metadata,
          ...(endParams?.level === 'ERROR'
            ? { tags: Array.from(new Set([...tags, 'error'])) }
            : {})
        });
      }
    };
  }

  async recordFeedback(params: RecordFeedbackParams): Promise<void> {
    if (!this.client) return;

    this.client.score({
      traceId: params.traceId,
      name: 'user_feedback',
      value: params.score,
      comment: params.comment,
      dataType: 'BOOLEAN'
    });

    await this.flush();
  }

  async flush(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.flushAsync();
    } catch (error) {
      this.logger.warn(
        `Failed to flush Langfuse events: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.shutdownAsync();
    } catch (error) {
      this.logger.warn(
        `Failed to shut down Langfuse client: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
