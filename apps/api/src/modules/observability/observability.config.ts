import type { AppEnv } from '../../shared/env/schema';

export type ObservabilityConfig = {
  enabled: boolean;
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
  environment: string;
};

export const getObservabilityConfig = (env: AppEnv): ObservabilityConfig => ({
  enabled: Boolean(env.LANGFUSE_ENABLED),
  publicKey: env.LANGFUSE_PUBLIC_KEY.trim(),
  secretKey: env.LANGFUSE_SECRET_KEY.trim(),
  baseUrl: env.LANGFUSE_BASE_URL.trim() || undefined,
  environment: env.OBSERVABILITY_ENVIRONMENT
});
