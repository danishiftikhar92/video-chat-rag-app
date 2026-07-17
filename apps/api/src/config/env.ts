import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { appEnvSchema, type AppEnv } from '@video-rag/shared';

function resolveEnvPath(): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../../../.env')
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

const envPath = resolveEnvPath();
config(envPath ? { path: envPath } : undefined);

let cachedEnv: AppEnv | null = null;

export const getEnv = (): AppEnv => {
  if (!cachedEnv) {
    cachedEnv = appEnvSchema.parse(process.env);
  }

  return cachedEnv;
};
