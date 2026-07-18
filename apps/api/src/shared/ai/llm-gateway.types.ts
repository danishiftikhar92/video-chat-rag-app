export type LlmProviderId = 'ollama' | 'openai' | 'mock';

export type LlmMessageRole = 'system' | 'user' | 'assistant';

export type LlmMessage = {
  role: LlmMessageRole;
  content: string;
};

export type LlmChatOptions = {
  model?: string;
  temperature?: number;
};

export type LlmModelInfo = {
  id: string;
  provider: LlmProviderId;
  label: string;
  capabilities: Array<'chat' | 'summarize'>;
};

export type LlmChatResult = {
  content: string;
  modelUsed: string;
  provider: LlmProviderId;
};

export interface LlmProvider {
  readonly id: LlmProviderId;
  listModels(): LlmModelInfo[];
  supportsModel(modelId: string): boolean;
  chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResult>;
}
