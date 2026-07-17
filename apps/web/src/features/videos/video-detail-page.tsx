import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileText, ListChecks, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { VideoThumbnail } from '@/components/video-thumbnail';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatDate, getSourceLabel } from '@/lib/utils';

export function VideoDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['video', id],
    queryFn: () => api.getVideo(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && query.state.data.video.status !== 'completed' &&
      query.state.data.video.status !== 'failed'
        ? 4000
        : false
  });

  const retryMutation = useMutation({
    mutationFn: () => api.retryVideo(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['video', id] }),
        queryClient.invalidateQueries({ queryKey: ['videos'] })
      ]);
      toast.success('Reprocessing started');
    },
    onError: (err) => toast.error((err as Error).message)
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteVideo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast.success('Video deleted');
      navigate('/videos');
    },
    onError: (err) => toast.error((err as Error).message)
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          {(error as Error).message}
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const { video, latestJob } = data;

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <VideoThumbnail video={video} className="aspect-video w-full" />
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold leading-snug">{video.title}</h1>
              <StatusBadge status={video.status} />
            </div>
            {video.sourceType === 'upload' ? (
              <p className="text-sm text-muted-foreground">{getSourceLabel(video.sourceUrl)}</p>
            ) : (
              <a
                href={video.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm text-muted-foreground hover:underline"
              >
                {getSourceLabel(video.sourceUrl)}
              </a>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Language" value={video.language} />
              <Meta label="Source" value={video.sourceType} />
              <Meta label="Created" value={formatDate(video.createdAt)} />
              <Meta label="Updated" value={formatDate(video.updatedAt)} />
            </div>
            {video.status !== 'completed' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{video.progressPercent}%</span>
                </div>
                <Progress value={video.progressPercent} />
              </div>
            )}
            {video.errorMessage && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {video.errorMessage}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button asChild variant="outline">
                <Link to={`/videos/${id}/transcript`}>
                  <FileText className="h-4 w-4" />
                  Transcript
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/videos/${id}/summary`}>
                  <ListChecks className="h-4 w-4" />
                  Summary
                </Link>
              </Button>
              <Button asChild disabled={video.status !== 'completed'}>
                <Link to={`/chat/video/${id}`}>
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </Link>
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {latestJob ? (
              <>
                <Meta label="Job type" value={latestJob.jobType} />
                <Meta label="Status" value={latestJob.status} />
                <Meta label="Attempts" value={String(latestJob.attemptCount)} />
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{latestJob.progressPercent}%</span>
                  </div>
                  <Progress value={latestJob.progressPercent} />
                </div>
                {latestJob.errorMessage && (
                  <p className="rounded-md bg-destructive/10 p-3 text-destructive">
                    {latestJob.errorMessage}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No job found yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this video?"
        description={`"${video.title}" and all its transcript, summary, chat, and stored files will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}
