import { BadRequestException } from '@nestjs/common';
import type { AppEnv } from '../env/schema';
import { createOllamaClientFromEnv } from './ollama.client';
import type { LlmChatOptions, LlmChatResult, LlmMessage, LlmModelInfo, LlmProvider } from './llm-gateway.types';
import { createOllamaLlmProvider } from './providers/ollama.llm-provider';
import { createOpenAiCompatibleLlmProvider } from './providers/openai-compatible.llm-provider';

class MockLlmProvider implements LlmProvider {
  readonly id = 'mock' as const;

  listModels(): LlmModelInfo[] {
    return [
      {
        id: 'mock',
        provider: 'mock',
        label: 'Mock',
        capabilities: ['chat', 'summarize']
      }
    ];
  }

  supportsModel(modelId: string): boolean {
    return modelId === 'mock';
  }

  async chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResult> {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    const content = `Mock reply: ${(lastUser?.content ?? '').slice(0, 400)}`;
    return { content, modelUsed: options?.model?.trim() || 'mock', provider: this.id };
  }
}

export class LlmGateway {
  private readonly providers: LlmProvider[];
  private readonly defaultModel: string;

  constructor(providers: LlmProvider[], defaultModel: string) {
    this.providers = providers;
    this.defaultModel = defaultModel;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  listModels(): LlmModelInfo[] {
    return this.providers.flatMap((provider) => provider.listModels());
  }

  resolveModel(requested?: string | null): string {
    const model = requested?.trim() || this.defaultModel;
    if (!this.findProvider(model)) {
      throw new BadRequestException(
        `Model "${model}" is not in the configured allowlist. Available: ${this.listModels()
          .map((item) => item.id)
          .join(', ')}`
      );
    }
    return model;
  }

  async chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResult> {
    const model = this.resolveModel(options?.model);
    const provider = this.findProvider(model);
    if (!provider) {
      throw new BadRequestException(`No provider registered for model "${model}"`);
    }

    const generation = options?.observability?.startGeneration({
      name: 'llm_call',
      model,
      input: messages,
      metadata: { provider: provider.id, temperature: options?.temperature }
    });

    const started = Date.now();
    try {
      const result = await provider.chat(messages, { ...options, model });
      generation?.end({
        output: result.content,
        usage: result.usage,
        metadata: {
          provider: result.provider,
          modelUsed: result.modelUsed,
          latencyMs: Date.now() - started
        }
      });
      return result;
    } catch (error) {
      generation?.end({
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : String(error),
        metadata: { latencyMs: Date.now() - started }
      });
      throw error;
    }
  }

  async summarize(input: string): Promise<string> {
    const maxChars = 12_000;
    const clipped =
      input.length > maxChars
        ? `${input.slice(0, maxChars)}\n\n[transcript truncated for summary]`
        : input;

    const result = await this.chat(
      [
        {
          role: 'user',
          content: `Summarize this transcript and extract key highlights as concise bullet points:\n\n${clipped}`
        }
      ],
      { model: this.defaultModel, temperature: 0.2 }
    );
    return result.content;
  }

  private findProvider(modelId: string): LlmProvider | undefined {
    return this.providers.find((provider) => provider.supportsModel(modelId));
  }
}

export const createLlmGatewayFromEnv = (env: AppEnv): LlmGateway => {
  if (env.LLM_PROVIDER === 'mock' || env.CHAT_PROVIDER === 'mock') {
    return new LlmGateway([new MockLlmProvider()], 'mock');
  }

  const providers: LlmProvider[] = [];
  const ollamaClient = createOllamaClientFromEnv(env);
  providers.push(createOllamaLlmProvider(env, ollamaClient));

  const openAi = createOpenAiCompatibleLlmProvider(env);
  if (openAi) {
    providers.push(openAi);
  }

  return new LlmGateway(providers, env.LLM_DEFAULT_MODEL);
};
