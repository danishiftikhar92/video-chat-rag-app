export type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ObservationLevel = 'DEFAULT' | 'ERROR' | 'WARNING' | 'DEBUG';

export type ObservabilitySpan = {
  end: (params?: {
    output?: unknown;
    metadata?: Record<string, unknown>;
    level?: ObservationLevel;
    statusMessage?: string;
  }) => void;
};

export type ObservabilityGeneration = {
  end: (params?: {
    output?: unknown;
    usage?: TokenUsage;
    metadata?: Record<string, unknown>;
    level?: ObservationLevel;
    statusMessage?: string;
  }) => void;
};

export type ObservabilityContext = {
  traceId: string;
  sessionId?: string;
  startSpan: (
    name: string,
    input?: unknown,
    metadata?: Record<string, unknown>
  ) => ObservabilitySpan;
  startGeneration: (params: {
    name: string;
    model?: string;
    input?: unknown;
    metadata?: Record<string, unknown>;
  }) => ObservabilityGeneration;
  event: (name: string, input?: unknown, metadata?: Record<string, unknown>) => void;
  update: (params: {
    output?: unknown;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }) => void;
  end: (params?: {
    output?: unknown;
    metadata?: Record<string, unknown>;
    level?: ObservationLevel;
    statusMessage?: string;
  }) => void;
};

export type StartTraceParams = {
  name: string;
  input?: unknown;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
};

export type RecordFeedbackParams = {
  traceId: string;
  score: 0 | 1;
  comment?: string;
  sessionId?: string;
};
