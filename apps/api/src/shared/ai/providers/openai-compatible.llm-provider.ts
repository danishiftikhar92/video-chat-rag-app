import type { AppEnv } from '../../env/schema';
import type { LlmChatOptions, LlmChatResult, LlmMessage, LlmModelInfo, LlmProvider } from '../llm-gateway.types';

export class OpenAiCompatibleLlmProvider implements LlmProvider {
  readonly id = 'openai' as const;
  private readonly models: LlmModelInfo[];
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: { baseUrl: string; apiKey: string; modelIds: string[]; timeoutMs?: number }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 300_000;
    this.models = options.modelIds.map((id) => ({
      id,
      provider: 'openai' as const,
      label: id,
      capabilities: ['chat', 'summarize'] as Array<'chat' | 'summarize'>
    }));
  }

  listModels(): LlmModelInfo[] {
    return [...this.models];
  }

  supportsModel(modelId: string): boolean {
    return this.models.some((model) => model.id === modelId);
  }

  async chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResult> {
    const model = options?.model?.trim() || this.models[0]?.id;
    if (!model || !this.supportsModel(model)) {
      throw new Error(`Model "${model ?? ''}" is not available on the OpenAI-compatible provider`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: options?.temperature ?? 0.2,
          messages
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `OpenAI-compatible request failed (${response.status}): ${detail || response.statusText}`
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error(`OpenAI-compatible response for model "${model}" was empty`);
      }

      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          }
        : undefined;

      return { content: content.trim(), modelUsed: model, provider: this.id, usage };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`OpenAI-compatible request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const createOpenAiCompatibleLlmProvider = (
  env: AppEnv
): OpenAiCompatibleLlmProvider | null => {
  const apiKey = env.LLM_OPENAI_API_KEY.trim();
  const modelIds = env.LLM_OPENAI_MODELS;
  if (!apiKey || modelIds.length === 0) {
    return null;
  }

  return new OpenAiCompatibleLlmProvider({
    baseUrl: env.LLM_OPENAI_BASE_URL.trim() || 'https://api.openai.com',
    apiKey,
    modelIds,
    timeoutMs: Number.parseInt(env.OLLAMA_TIMEOUT_MS ?? '300000', 10) || 300_000
  });
};
