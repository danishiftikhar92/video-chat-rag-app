import { createOllamaClientFromEnv } from '@video-rag/shared';
import { getEnv } from '../config/env';

export interface ChatProvider {
  summarize(input: string): Promise<string>;
}

class MockChatProvider implements ChatProvider {
  async summarize(input: string): Promise<string> {
    return `Summary: ${input.slice(0, 400)}`;
  }
}

class OllamaChatProvider implements ChatProvider {
  private readonly client = createOllamaClientFromEnv(getEnv());

  async summarize(input: string): Promise<string> {
    return this.client.chat(
      `Summarize this transcript and extract key highlights as concise bullet points:\n\n${input}`,
      { temperature: 0.2 }
    );
  }
}

export const createChatProvider = (): ChatProvider => {
  const env = getEnv();
  switch (env.CHAT_PROVIDER) {
    case 'mock':
      return new MockChatProvider();
    case 'ollama':
      return new OllamaChatProvider();
    default:
      throw new Error(`Unsupported chat provider: ${env.CHAT_PROVIDER}`);
  }
};
