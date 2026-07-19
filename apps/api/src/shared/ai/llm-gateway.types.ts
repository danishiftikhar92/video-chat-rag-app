export type LlmProviderId = 'ollama' | 'openai' | 'mock';

export type LlmMessageRole = 'system' | 'user' | 'assistant';

export type LlmMessage = {
  role: LlmMessageRole;
  content: string;
};

export type LlmTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

/** Minimal hooks so LlmGateway can nest generations without importing Nest modules. */
export type LlmObservabilityHooks = {
  startGeneration: (params: {
    name: string;
    model?: string;
    input?: unknown;
    metadata?: Record<string, unknown>;
  }) => {
    end: (params?: {
      output?: unknown;
      usage?: LlmTokenUsage;
      metadata?: Record<string, unknown>;
      level?: 'DEFAULT' | 'ERROR' | 'WARNING' | 'DEBUG';
      statusMessage?: string;
    }) => void;
  };
};

export type LlmChatOptions = {
  model?: string;
  temperature?: number;
  observability?: LlmObservabilityHooks;
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
  usage?: LlmTokenUsage;
};

export interface LlmProvider {
  readonly id: LlmProviderId;
  listModels(): LlmModelInfo[];
  supportsModel(modelId: string): boolean;
  chat(messages: LlmMessage[], options?: LlmChatOptions): Promise<LlmChatResult>;
}
