import { z } from 'zod';

export const storageProviderSchema = z.enum(['local', 's3']);
export const transcriptionProviderSchema = z.enum(['whispercpp', 'mock']);
export const chatProviderSchema = z.enum(['ollama', 'mock']);
export const embeddingProviderSchema = z.enum(['ollama', 'mock']);
export const llmProviderSchema = z.enum(['ollama', 'mock']);

const DEFAULT_CHAT_MODELS = 'llama3.2:1b,qwen2.5:1.5b,smollm2:1.7b,gemma2:2b,phi3:mini';

const parseCsv = (value: string | undefined, fallback = ''): string[] =>
  (value ?? fallback)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export const appEnvSchema = z
  .object({
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
    LLM_PROVIDER: llmProviderSchema.default('ollama'),
    LLM_DEFAULT_MODEL: z.string().optional(),
    LLM_AVAILABLE_MODELS: z.string().optional(),
    LLM_OPENAI_BASE_URL: z.string().default(''),
    LLM_OPENAI_API_KEY: z.string().default(''),
    LLM_OPENAI_MODELS: z.string().optional(),
    OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
    OLLAMA_CHAT_MODEL: z.string().default('llama3.2:1b'),
    OLLAMA_EMBED_MODEL: z.string().default('all-minilm'),
    OLLAMA_TIMEOUT_MS: z.string().default('300000'),
    EMBEDDING_DIMENSIONS: z.string().default('384'),
    ALLOWED_SOURCE_HOSTS: z.string().default('youtube.com,www.youtube.com,youtu.be'),
    MAX_VIDEO_DURATION_SECONDS: z.string().default('21600'),
    MAX_DOWNLOAD_SIZE_MB: z.string().default('512'),
    MAX_UPLOAD_SIZE_MB: z.string().default('512'),
    TYPEORM_SYNC: z.string().default('false'),
    INGESTION_RATE_LIMIT: z.string().default('10'),
    CHAT_RATE_LIMIT: z.string().default('60')
  })
  .transform((env) => {
    const available = parseCsv(env.LLM_AVAILABLE_MODELS, DEFAULT_CHAT_MODELS);
    const openAiModels = parseCsv(env.LLM_OPENAI_MODELS, '');
    const defaultModel = env.LLM_DEFAULT_MODEL?.trim() || env.OLLAMA_CHAT_MODEL || available[0];
    return {
      ...env,
      LLM_AVAILABLE_MODELS: available.length > 0 ? available : parseCsv(DEFAULT_CHAT_MODELS),
      LLM_OPENAI_MODELS: openAiModels,
      LLM_DEFAULT_MODEL: defaultModel,
      OLLAMA_CHAT_MODEL: defaultModel
    };
  })
  .superRefine((env, ctx) => {
    if (!env.LLM_AVAILABLE_MODELS.includes(env.LLM_DEFAULT_MODEL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `LLM_DEFAULT_MODEL "${env.LLM_DEFAULT_MODEL}" must be listed in LLM_AVAILABLE_MODELS`,
        path: ['LLM_DEFAULT_MODEL']
      });
    }
  });

export type AppEnv = z.infer<typeof appEnvSchema>;
