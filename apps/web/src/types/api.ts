export type SourceType = 'youtube' | 'direct' | 'upload';
export type VideoStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type ChatRole = 'user' | 'assistant' | 'system';

export type CreateVideoInput = {
  sourceUrl: string;
  requestedBy?: string;
};

export type VideoDto = {
  id: string;
  sourceUrl: string;
  sourceType: SourceType;
  title: string;
  thumbnailUrl?: string | null;
  durationSeconds: number;
  language: string;
  status: VideoStatus;
  progressPercent: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobDto = {
  id: string;
  videoId: string;
  jobType: string;
  status: JobStatus;
  attemptCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  progressPercent: number;
};

export type VideoListResponse = {
  items: VideoDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type TranscriptSegment = {
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
  speaker?: string;
};

export type TranscriptDto = {
  videoId: string;
  language: string;
  rawText: string;
  segments: TranscriptSegment[];
};

export type SummaryHighlight = {
  title: string;
  detail: string;
  startTime?: number;
  endTime?: number;
};

export type SummaryDto = {
  videoId: string;
  summaryText: string;
  highlights: SummaryHighlight[];
  createdAt: string;
};

export type Citation = {
  chunkId: string;
  videoId: string;
  videoTitle?: string;
  contentSnippet: string;
  startTime: number;
  endTime: number;
};

export type ChatMessageDto = {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  citations: Citation[];
  createdAt: string;
};

export type ChatResponse = {
  sessionId: string;
  answer: string;
  citations: Citation[];
  confidence: number;
  modelUsed: string;
  messages: ChatMessageDto[];
  guardrailApplied?: GuardrailApplied;
};

export type GuardRailType = 'prompt_injection' | 'pii_mask' | 'scope' | 'harmful_content';
export type GuardRailDirection = 'input' | 'output' | 'both';

export type GuardRailConfig = {
  patterns?: string[];
  keywords?: string[];
  allowKeywords?: string[];
  denyKeywords?: string[];
  refusalMessage?: string;
};

export type GuardRailDto = {
  id: string;
  name: string;
  description: string | null;
  type: GuardRailType;
  direction: GuardRailDirection;
  enabled: boolean;
  priority: number;
  config: GuardRailConfig;
  createdAt: string;
  updatedAt: string;
};

export type CreateGuardRailInput = {
  name: string;
  description?: string | null;
  type: GuardRailType;
  direction: GuardRailDirection;
  enabled?: boolean;
  priority?: number;
  config?: GuardRailConfig;
};

export type UpdateGuardRailInput = Partial<CreateGuardRailInput>;

export type GuardrailApplied = {
  blocked: boolean;
  reasons: string[];
  appliedRailIds: string[];
};

export type LlmModelInfo = {
  id: string;
  provider: 'ollama' | 'openai' | 'mock';
  label: string;
  capabilities: Array<'chat' | 'summarize'>;
};

export type LlmModelsResponse = {
  defaultModel: string;
  models: LlmModelInfo[];
};
