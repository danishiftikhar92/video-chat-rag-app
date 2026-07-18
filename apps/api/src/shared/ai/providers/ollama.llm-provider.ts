import type { AppEnv } from '../../env/schema';
import { OllamaClient } from '../ollama.client';
import type { LlmChatOptions, LlmChatResult, LlmMessage, LlmModelInfo, LlmProvider } from '../llm-gateway.types';

const modelLabel = (id: string): string => id;

export class OllamaLlmProvider implements LlmProvider {
  readonly id = 'ollama' as const;
  private readonly models: LlmModelInfo[];

  constructor(
    private readonly client: OllamaClient,
    modelIds: string[]
  ) {
    this.models = modelIds.map((id) => ({
      id,
      provider: 'ollama' as const,
      label: modelLabel(id),
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
      throw new Error(`Model "${model ?? ''}" is not available on the Ollama provider`);
    }

    const content = await this.client.chatMessages(messages, {
      model,
      temperature: options?.temperature
    });

    return { content, modelUsed: model, provider: this.id };
  }
}

export const createOllamaLlmProvider = (env: AppEnv, client: OllamaClient): OllamaLlmProvider =>
  new OllamaLlmProvider(client, env.LLM_AVAILABLE_MODELS);
