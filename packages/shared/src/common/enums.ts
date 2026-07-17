export const videoStatuses = ['queued', 'processing', 'completed', 'failed'] as const;
export type VideoStatus = (typeof videoStatuses)[number];

export const jobStatuses = ['queued', 'running', 'completed', 'failed'] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const sourceTypes = ['youtube', 'direct', 'upload'] as const;
export type SourceType = (typeof sourceTypes)[number];

export const chatRoles = ['user', 'assistant', 'system'] as const;
export type ChatRole = (typeof chatRoles)[number];

export const summaryModes = ['summary', 'highlights', 'action_items'] as const;
export type SummaryMode = (typeof summaryModes)[number];
