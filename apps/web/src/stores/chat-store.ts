import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatState {
  sessionByVideo: Record<string, string>;
  lastVideoId: string | null;
  setSession: (videoId: string, sessionId: string) => void;
  clearSession: (videoId: string) => void;
  setLastVideoId: (videoId: string | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionByVideo: {},
      lastVideoId: null,
      setSession: (videoId, sessionId) =>
        set((state) => ({
          sessionByVideo: { ...state.sessionByVideo, [videoId]: sessionId },
          lastVideoId: videoId
        })),
      clearSession: (videoId) =>
        set((state) => {
          const next = { ...state.sessionByVideo };
          delete next[videoId];
          return { sessionByVideo: next };
        }),
      setLastVideoId: (lastVideoId) => set({ lastVideoId })
    }),
    {
      name: 'video-rag-chat-sessions'
    }
  )
);
