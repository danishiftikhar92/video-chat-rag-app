import { createOllamaClientFromEnv } from '../../../shared';
import { getEnv } from '../../../config/env';

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    const dims = Number.parseInt(getEnv().EMBEDDING_DIMENSIONS, 10) || 384;
    return texts.map((text) => {
      const vector = Array.from({ length: dims }, (_, index) => ((text.length + index) % 97) / 97);
      return vector;
    });
  }
}

class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly client = createOllamaClientFromEnv(getEnv());
  private readonly dimensions = Number.parseInt(getEnv().EMBEDDING_DIMENSIONS, 10) || 384;

  async embed(texts: string[]): Promise<number[][]> {
    const vectors = await this.client.embed(texts);
    for (const [index, vector] of vectors.entries()) {
      if (vector.length !== this.dimensions) {
        throw new Error(
          `Embedding dimension mismatch for item ${index}: got ${vector.length}, expected ${this.dimensions}. Set EMBEDDING_DIMENSIONS to match OLLAMA_EMBED_MODEL (${getEnv().OLLAMA_EMBED_MODEL}).`
        );
      }
    }
    return vectors;
  }
}

export const createEmbeddingProvider = (): EmbeddingProvider => {
  const env = getEnv();
  switch (env.EMBEDDING_PROVIDER) {
    case 'mock':
      return new MockEmbeddingProvider();
    case 'ollama':
      return new OllamaEmbeddingProvider();
    default:
      throw new Error(`Unsupported embedding provider: ${env.EMBEDDING_PROVIDER}`);
  }
};
