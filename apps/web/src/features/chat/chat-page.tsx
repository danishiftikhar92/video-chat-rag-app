import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, MessageSquare, SendHorizontal, Sparkles, ThumbsDown, ThumbsUp, Trash2, User } from 'lucide-react';
import type { VideoDto } from '@/types/api';
import { api, type Citation, type SessionMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn, formatTimestamp } from '@/lib/utils';
import { useChatStore } from '@/stores/chat-store';
import { useUiStore } from '@/stores/ui-store';

interface ChatMessage {
  role: string;
  content: string;
  citations?: Citation[];
  modelUsed?: string;
  guardrailBlocked?: boolean;
  traceId?: string;
  feedback?: 'up' | 'down';
}

export function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sessionByVideo = useChatStore((state) => state.sessionByVideo);
  const setSession = useChatStore((state) => state.setSession);
  const clearSession = useChatStore((state) => state.clearSession);
  const setLastVideoId = useChatStore((state) => state.setLastVideoId);
  const lastVideoId = useChatStore((state) => state.lastVideoId);
  const defaultChatModel = useUiStore((state) => state.defaultChatModel);

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);

  const sessionId = id ? sessionByVideo[id] : undefined;

  const { data: videosData } = useQuery({
    queryKey: ['videos', 'all'],
    queryFn: () => api.listVideos(1, 100)
  });
  const videos = videosData?.items ?? [];
  const activeVideo = videos.find((video) => video.id === id);

  const modelsQuery = useQuery({
    queryKey: ['llm-models'],
    queryFn: () => api.listLlmModels()
  });

  useEffect(() => {
    if (!modelsQuery.data) return;
    const ids = modelsQuery.data.models.map((model) => model.id);
    const preferred =
      (selectedModel && ids.includes(selectedModel) && selectedModel) ||
      (defaultChatModel && ids.includes(defaultChatModel) && defaultChatModel) ||
      modelsQuery.data.defaultModel;
    if (preferred !== selectedModel) {
      setSelectedModel(preferred);
    }
  }, [modelsQuery.data, defaultChatModel, selectedModel]);

  const historyQuery = useQuery({
    queryKey: ['session-messages', sessionId],
    queryFn: () => api.getSessionMessages(sessionId as string),
    enabled: Boolean(sessionId)
  });

  useEffect(() => {
    if (id) setLastVideoId(id);
  }, [id, setLastVideoId]);

  useEffect(() => {
    if (historyQuery.data) {
      setMessages((current) => {
        const priorByKey = new Map(
          current
            .filter((message) => message.traceId || message.feedback || message.modelUsed)
            .map((message) => [`${message.role}:${message.content}`, message] as const)
        );

        return historyQuery.data.map((message: SessionMessage) => {
          const prior = priorByKey.get(`${message.role}:${message.content}`);
          return {
            role: message.role,
            content: message.content,
            citations: message.citations,
            traceId: prior?.traceId,
            feedback: prior?.feedback,
            modelUsed: prior?.modelUsed,
            guardrailBlocked: prior?.guardrailBlocked
          };
        });
      });
    } else if (!sessionId) {
      setMessages([]);
    }
  }, [historyQuery.data, sessionId]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const viewport = logRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    });
  };

  const mutation = useMutation({
    mutationFn: (text: string) => api.chat(id as string, text, sessionId, selectedModel || undefined),
    onSuccess: (response) => {
      if (id) setSession(id, response.sessionId);
      queryClient.setQueryData(
        ['session-messages', response.sessionId],
        response.messages.map((message) => ({
          id: message.id,
          sessionId: message.sessionId,
          role: message.role,
          content: message.content,
          citations: message.citations,
          createdAt: message.createdAt
        }))
      );
      setMessages((current) => {
        const priorByKey = new Map(
          current
            .filter((message) => message.traceId || message.feedback || message.modelUsed)
            .map((message) => [`${message.role}:${message.content}`, message] as const)
        );

        return response.messages.map((message, index, all) => {
          const isLatestAssistant = message.role === 'assistant' && index === all.length - 1;
          const prior = priorByKey.get(`${message.role}:${message.content}`);
          return {
            role: message.role,
            content: message.content,
            citations: message.citations,
            modelUsed: isLatestAssistant ? response.modelUsed : prior?.modelUsed,
            guardrailBlocked: isLatestAssistant
              ? Boolean(response.guardrailApplied?.blocked)
              : prior?.guardrailBlocked,
            traceId: isLatestAssistant ? response.traceId : prior?.traceId,
            feedback: isLatestAssistant ? undefined : prior?.feedback
          };
        });
      });
      scrollToBottom();
    },
    onError: (err) => {
      toast.error((err as Error).message);
      setMessages((current) => current.slice(0, -1));
    }
  });

  const clearMutation = useMutation({
    mutationFn: () => api.clearSessionHistory(sessionId as string),
    onSuccess: () => {
      if (id) clearSession(id);
      setMessages([]);
      setConfirmClearOpen(false);
      queryClient.removeQueries({ queryKey: ['session-messages', sessionId] });
      toast.success('Chat history cleared');
    },
    onError: (err) => toast.error((err as Error).message)
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (!text || !id) return;
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setQuery('');
    scrollToBottom();
    mutation.mutate(text);
  };

  const handleSelectVideo = (videoId: string) => {
    navigate(`/chat/video/${videoId}`);
  };

  if (!id) {
    return (
      <ChatEmptyState
        videos={videos}
        lastVideoId={lastVideoId}
        onSelect={handleSelectVideo}
      />
    );
  }

  return (
    <section className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">
            {activeVideo?.title ?? 'Video Chat'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Grounded answers with transcript citations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={id} onValueChange={handleSelectVideo}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a video" />
            </SelectTrigger>
            <SelectContent>
              {videos.map((video) => (
                <SelectItem key={video.id} value={video.id} disabled={video.status !== 'completed'}>
                  <span className="line-clamp-1">{video.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfirmClearOpen(true)}
            disabled={messages.length === 0 || !sessionId}
            aria-label="Clear chat history"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ScrollArea className="flex-1" ref={logRef}>
          <div className="space-y-4 p-4">
            {historyQuery.isLoading && sessionId ? (
              <MessagesSkeleton />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">Ask anything about this video</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Topics, timelines, decisions, or request a summary. Answers cite transcript
                  timestamps.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <MessageBubble
                  key={index}
                  message={message}
                  sessionId={sessionId}
                  onFeedback={(feedback) => {
                    setMessages((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, feedback } : item
                      )
                    );
                  }}
                />
              ))
            )}
            {mutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bot className="h-4 w-4" />
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={onSubmit} className="border-t p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Model</span>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={!modelsQuery.data || modelsQuery.isLoading}
            >
              <SelectTrigger className="h-8 w-[220px]">
                <SelectValue placeholder={modelsQuery.isLoading ? 'Loading…' : 'Select model'} />
              </SelectTrigger>
              <SelectContent>
                {(modelsQuery.data?.models ?? []).map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              rows={1}
              placeholder="Ask a question... (Enter to send, Shift+Enter for newline)"
              className="max-h-32 min-h-[44px] resize-none"
              disabled={activeVideo && activeVideo.status !== 'completed'}
            />
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0"
              disabled={mutation.isPending || !query.trim()}
            >
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </div>
          {activeVideo && activeVideo.status !== 'completed' && (
            <p className="mt-2 text-xs text-muted-foreground">
              This video is still {activeVideo.status}. Chat is available once processing completes.
            </p>
          )}
        </form>
      </Card>

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear chat history?</DialogTitle>
            <DialogDescription>
              This permanently deletes all messages for this video&apos;s current session. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? 'Clearing...' : 'Clear history'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MessageBubble({
  message,
  sessionId,
  onFeedback
}: {
  message: ChatMessage;
  sessionId?: string;
  onFeedback: (feedback: 'up' | 'down') => void;
}) {
  const isUser = message.role === 'user';
  const [pending, setPending] = useState(false);

  const submitFeedback = async (value: 'up' | 'down') => {
    if (!message.traceId || message.feedback || pending) return;
    setPending(true);
    try {
      await api.submitFeedback({
        traceId: message.traceId,
        score: value === 'up' ? 1 : 0,
        sessionId
      });
      onFeedback(value);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to submit feedback');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn('max-w-[80%] space-y-2', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {!isUser && (message.modelUsed || message.traceId) && (
          <div className="flex flex-wrap items-center gap-2">
            {message.modelUsed && (
              <p className="text-[11px] text-muted-foreground">
                via {message.modelUsed}
                {message.guardrailBlocked ? ' · blocked by guard rail' : ''}
              </p>
            )}
            {message.traceId && (
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7 text-muted-foreground',
                    message.feedback === 'up' && 'text-foreground'
                  )}
                  disabled={Boolean(message.feedback) || pending}
                  aria-label="Thumbs up"
                  onClick={() => void submitFeedback('up')}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7 text-muted-foreground',
                    message.feedback === 'down' && 'text-foreground'
                  )}
                  disabled={Boolean(message.feedback) || pending}
                  aria-label="Thumbs down"
                  onClick={() => void submitFeedback('down')}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.citations.map((citation, index) => (
              <Badge key={index} variant="outline" className="font-normal" title={citation.contentSnippet}>
                {formatTimestamp(citation.startTime)}–{formatTimestamp(citation.endTime)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
      </div>
      <div className="flex flex-row-reverse gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-10 w-1/2 rounded-2xl" />
      </div>
    </div>
  );
}

function ChatEmptyState({
  videos,
  lastVideoId,
  onSelect
}: {
  videos: VideoDto[];
  lastVideoId: string | null;
  onSelect: (videoId: string) => void;
}) {
  const completed = videos.filter((video) => video.status === 'completed');
  const resumeVideo = lastVideoId ? videos.find((video) => video.id === lastVideoId) : undefined;

  return (
    <section className="mx-auto max-w-xl space-y-6 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MessageSquare className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Chat with your videos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a processed video to start a grounded conversation.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          {resumeVideo && resumeVideo.status === 'completed' && (
            <Button variant="outline" className="w-full justify-start" onClick={() => onSelect(resumeVideo.id)}>
              <Sparkles className="h-4 w-4" />
              Resume: {resumeVideo.title}
            </Button>
          )}
          <Select onValueChange={onSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a video to chat with" />
            </SelectTrigger>
            <SelectContent>
              {videos.map((video) => (
                <SelectItem key={video.id} value={video.id} disabled={video.status !== 'completed'}>
                  {video.title}
                  {video.status !== 'completed' ? ` (${video.status})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {completed.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              No processed videos available yet. Upload and wait for processing to complete.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
