import type {
  ChatResponse,
  CreateGuardRailInput,
  CreateVideoInput,
  GuardRailDto,
  JobDto,
  LlmModelsResponse,
  SummaryDto,
  TranscriptDto,
  UpdateGuardRailInput,
  VideoDto,
  VideoListResponse
} from '@/types/api';
import { useUiStore } from '@/stores/ui-store';

function getApiBase(): string {
  const configured = useUiStore.getState().apiBaseUrl?.trim();
  return (configured || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface Citation {
  startTime: number;
  endTime: number;
  contentSnippet: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  createdAt: string;
}

interface RawSessionMessage {
  id: string;
  sessionId: string;
  role: SessionMessage['role'];
  content: string;
  citationsJson?: Citation[];
  citations?: Citation[];
  createdAt: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

type VideoDetail = { video: VideoDto; latestJob: JobDto | null };

export const api = {
  listVideos: (page = 1, pageSize = 12) =>
    request<VideoListResponse>(`/videos?page=${page}&pageSize=${pageSize}`),

  createVideo: (input: CreateVideoInput) =>
    request<VideoDetail>('/videos', {
      method: 'POST',
      body: JSON.stringify(input)
    }),

  uploadVideo: (file: File, onProgress?: (progress: UploadProgress) => void) =>
    new Promise<VideoDetail>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${getApiBase()}/videos/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100)
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as VideoDetail);
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Invalid response'));
          }
        } else {
          reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    }),

  getVideo: (id: string) => request<VideoDetail>(`/videos/${id}`),
  getVideoStatus: (id: string) =>
    request<{ videoId: string; status: string; progressPercent: number; latestJob: JobDto | null }>(
      `/videos/${id}/status`
    ),
  retryVideo: (id: string) => request<VideoDetail>(`/videos/${id}/retry`, { method: 'POST' }),
  deleteVideo: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/videos/${id}`, { method: 'DELETE' }),
  getTranscript: (id: string) => request<TranscriptDto>(`/videos/${id}/transcript`),
  getSummary: (id: string) => request<SummaryDto>(`/videos/${id}/summary`),

  listLlmModels: () => request<LlmModelsResponse>('/llm/models'),

  chat: (id: string, query: string, sessionId?: string, model?: string) =>
    request<ChatResponse>(`/videos/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ query, sessionId, model })
    }),

  getSessionMessages: async (sessionId: string): Promise<SessionMessage[]> => {
    const raw = await request<RawSessionMessage[]>(`/sessions/${sessionId}/messages`);
    return raw.map((message) => ({
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      citations: message.citations ?? message.citationsJson ?? [],
      createdAt: message.createdAt
    }));
  },

  clearSessionHistory: (sessionId: string) =>
    request<{ sessionId: string; cleared: boolean }>(`/sessions/${sessionId}/messages`, {
      method: 'DELETE'
    }),

  listGuardrails: () => request<GuardRailDto[]>('/guardrails'),
  createGuardrail: (input: CreateGuardRailInput) =>
    request<GuardRailDto>('/guardrails', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  updateGuardrail: (id: string, input: UpdateGuardRailInput) =>
    request<GuardRailDto>(`/guardrails/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    }),
  deleteGuardrail: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/guardrails/${id}`, { method: 'DELETE' }),

  listJobs: () => request<JobDto[]>('/admin/jobs')
};
