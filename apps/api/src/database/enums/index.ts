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
