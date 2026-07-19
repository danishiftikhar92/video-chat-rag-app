export enum VideoStatus {
  queued = 'queued',
  processing = 'processing',
  completed = 'completed',
  failed = 'failed'
}

export enum JobStatus {
  queued = 'queued',
  running = 'running',
  completed = 'completed',
  failed = 'failed'
}

export enum SourceType {
  youtube = 'youtube',
  direct = 'direct',
  upload = 'upload'
}

export enum ChatRole {
  user = 'user',
  assistant = 'assistant',
  system = 'system'
}

export enum GuardRailType {
  prompt_injection = 'prompt_injection',
  pii_mask = 'pii_mask',
  scope = 'scope',
  harmful_content = 'harmful_content'
}

export enum GuardRailDirection {
  input = 'input',
  output = 'output',
  both = 'both'
}
