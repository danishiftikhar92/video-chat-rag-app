export type OllamaClientOptions = {
  baseUrl: string;
  chatModel: string;
  embedModel: string;
  timeoutMs?: number;
};

export class OllamaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly chatModel: string;
  private readonly embedModel: string;
  private readonly timeoutMs: number;

  constructor(options: OllamaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.chatModel = options.chatModel;
    this.embedModel = options.embedModel;
    this.timeoutMs = options.timeoutMs ?? 300_000;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const text of texts) {
      vectors.push(await this.embedOne(text));
    }
    return vectors;
  }

  async embedOne(text: string): Promise<number[]> {
    const data = await this.postJson<{ embedding?: number[] }>('/api/embeddings', {
      model: this.embedModel,
      prompt: text
    });

    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new OllamaError(
        `Ollama embeddings response for model "${this.embedModel}" did not include a vector. Pull the model with: ollama pull ${this.embedModel}`
      );
    }

    return data.embedding;
  }

  async chat(
    prompt: string,
    options?: { temperature?: number; system?: string; model?: string }
  ): Promise<string> {
    const model = options?.model?.trim() || this.chatModel;
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: prompt });

    const data = await this.postJson<{ message?: { content?: string }; response?: string }>('/api/chat', {
      model,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.2
      },
      messages
    });

    const content = data.message?.content ?? data.response;
    if (typeof content !== 'string' || !content.trim()) {
      throw new OllamaError(
        `Ollama chat response for model "${model}" was empty. Pull the model with: ollama pull ${model}`
      );
    }

    return content.trim();
  }

  async chatMessages(
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number; model?: string }
  ): Promise<{
    content: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }> {
    const model = options?.model?.trim() || this.chatModel;
    const data = await this.postJson<{
      message?: { content?: string };
      response?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    }>('/api/chat', {
      model,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.2
      },
      messages
    });

    const content = data.message?.content ?? data.response;
    if (typeof content !== 'string' || !content.trim()) {
      throw new OllamaError(
        `Ollama chat response for model "${model}" was empty. Pull the model with: ollama pull ${model}`
      );
    }

    const promptTokens =
      typeof data.prompt_eval_count === 'number' ? data.prompt_eval_count : undefined;
    const completionTokens = typeof data.eval_count === 'number' ? data.eval_count : undefined;
    const usage =
      promptTokens !== undefined || completionTokens !== undefined
        ? {
            promptTokens,
            completionTokens,
            totalTokens:
              promptTokens !== undefined || completionTokens !== undefined
                ? (promptTokens ?? 0) + (completionTokens ?? 0)
                : undefined
          }
        : undefined;

    return { content: content.trim(), usage };
  }

  async generate(prompt: string, options?: { temperature?: number; model?: string }): Promise<string> {
    const model = options?.model?.trim() || this.chatModel;
    const data = await this.postJson<{ response?: string }>('/api/generate', {
      model,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.2
      }
    });

    if (typeof data.response !== 'string' || !data.response.trim()) {
      throw new OllamaError(
        `Ollama generate response for model "${model}" was empty. Pull the model with: ollama pull ${model}`
      );
    }

    return data.response.trim();
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new OllamaError(
          `Ollama request to ${path} failed (${response.status}): ${detail || response.statusText}. Is Ollama running at ${this.baseUrl}?`,
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof OllamaError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OllamaError(`Ollama request to ${path} timed out after ${this.timeoutMs}ms`, undefined, error);
      }
      throw new OllamaError(
        `Unable to reach Ollama at ${this.baseUrl}${path}. Start it with Docker Compose or ensure the service is running.`,
        undefined,
        error
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export const createOllamaClientFromEnv = (env: {
  OLLAMA_BASE_URL: string;
  OLLAMA_CHAT_MODEL: string;
  OLLAMA_EMBED_MODEL: string;
  OLLAMA_TIMEOUT_MS?: string;
}): OllamaClient =>
  new OllamaClient({
    baseUrl: env.OLLAMA_BASE_URL,
    chatModel: env.OLLAMA_CHAT_MODEL,
    embedModel: env.OLLAMA_EMBED_MODEL,
    timeoutMs: Number.parseInt(env.OLLAMA_TIMEOUT_MS ?? '300000', 10) || 300_000
  });

/** Format a numeric vector for pgvector parameterized casts. */
export const toPgVectorLiteral = (values: number[]): string => `[${values.join(',')}]`;
