import { createLlmGatewayFromEnv } from '../../../shared';
import { getEnv } from '../../../config/env';

export const CHAT_PROVIDER = Symbol('CHAT_PROVIDER');

export interface ChatProvider {
  summarize(input: string): Promise<string>;
}

class MockChatProvider implements ChatProvider {
  async summarize(input: string): Promise<string> {
    return `Summary: ${input.slice(0, 400)}`;
  }
}

class GatewayChatProvider implements ChatProvider {
  private readonly gateway = createLlmGatewayFromEnv(getEnv());

  async summarize(input: string): Promise<string> {
    return this.gateway.summarize(input);
  }
}

export const createChatProvider = (): ChatProvider => {
  const env = getEnv();
  switch (env.CHAT_PROVIDER) {
    case 'mock':
      return new MockChatProvider();
    case 'ollama':
      return new GatewayChatProvider();
    default:
      throw new Error(`Unsupported chat provider: ${env.CHAT_PROVIDER}`);
  }
};
