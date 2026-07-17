import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';
export type VideoView = 'card' | 'table';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface UiState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  videoView: VideoView;
  pageSize: number;
  videoPage: number;
  apiBaseUrl: string;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setVideoView: (view: VideoView) => void;
  setPageSize: (size: number) => void;
  setVideoPage: (page: number) => void;
  setApiBaseUrl: (url: string) => void;
  resetPreferences: () => void;
}

export const DEFAULT_PREFERENCES = {
  theme: 'system' as ThemeMode,
  sidebarCollapsed: false,
  videoView: 'card' as VideoView,
  pageSize: 9,
  apiBaseUrl: DEFAULT_API_BASE
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      videoPage: 1,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setVideoView: (videoView) => set({ videoView }),
      setPageSize: (pageSize) => set({ pageSize, videoPage: 1 }),
      setVideoPage: (videoPage) => set({ videoPage }),
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
      resetPreferences: () => set({ ...DEFAULT_PREFERENCES, videoPage: 1 })
    }),
    {
      name: 'video-rag-ui-preferences',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        videoView: state.videoView,
        pageSize: state.pageSize,
        apiBaseUrl: state.apiBaseUrl
      })
    }
  )
);
