import { z } from 'zod';

export const storageProviderSchema = z.enum(['local', 's3']);
export const transcriptionProviderSchema = z.enum(['whispercpp', 'mock']);
export const chatProviderSchema = z.enum(['ollama', 'mock']);
export const embeddingProviderSchema = z.enum(['ollama', 'mock']);

export const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000'),
  WEB_PORT: z.string().default('5173'),
  WORKER_CONCURRENCY: z.string().default('2'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  STORAGE_PROVIDER: storageProviderSchema.default('local'),
  LOCAL_STORAGE_ROOT: z.string().default('./uploads'),
  AUDIO_TEMP_DIR: z.string().default('./uploads/tmp'),
  TRANSCRIPTION_PROVIDER: transcriptionProviderSchema.default('whispercpp'),
  WHISPER_BIN_PATH: z.string().default('whisper-cli'),
  WHISPER_MODEL_PATH: z.string().default('./models/ggml-base.bin'),
  CHAT_PROVIDER: chatProviderSchema.default('ollama'),
  EMBEDDING_PROVIDER: embeddingProviderSchema.default('ollama'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_CHAT_MODEL: z.string().default('llama3.2:1b'),
  OLLAMA_EMBED_MODEL: z.string().default('all-minilm'),
  EMBEDDING_DIMENSIONS: z.string().default('384'),
  ALLOWED_SOURCE_HOSTS: z.string().default('youtube.com,www.youtube.com,youtu.be'),
  MAX_VIDEO_DURATION_SECONDS: z.string().default('21600'),
  MAX_DOWNLOAD_SIZE_MB: z.string().default('512'),
  MAX_UPLOAD_SIZE_MB: z.string().default('512'),
  TYPEORM_SYNC: z.string().default('false'),
  INGESTION_RATE_LIMIT: z.string().default('10'),
  CHAT_RATE_LIMIT: z.string().default('60')
});

export type AppEnv = z.infer<typeof appEnvSchema>;
