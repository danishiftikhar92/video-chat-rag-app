import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, MessageSquare, Plus, Table as TableIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VideoDto } from '@/types/api';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import { VideoThumbnail } from '@/components/video-thumbnail';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cn, formatDate, getSourceLabel } from '@/lib/utils';
import { useUiStore } from '@/stores/ui-store';

export function VideosPage() {
  const videoView = useUiStore((state) => state.videoView);
  const setVideoView = useUiStore((state) => state.setVideoView);
  const pageSize = useUiStore((state) => state.pageSize);
  const page = useUiStore((state) => state.videoPage);
  const setPage = useUiStore((state) => state.setVideoPage);
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<VideoDto | null>(null);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['videos', page, pageSize],
    queryFn: () => api.listVideos(page, pageSize),
    placeholderData: keepPreviousData
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteVideo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast.success('Video deleted');
      setPendingDelete(null);
    },
    onError: (err) => toast.error((err as Error).message)
  });

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  useEffect(() => {
    if (data && page > pageCount) setPage(pageCount);
  }, [data, page, pageCount, setPage]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Videos</h1>
          <p className="text-sm text-muted-foreground">
            Processed and in-flight video ingestion jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              variant={videoView === 'card' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setVideoView('card')}
              aria-label="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={videoView === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setVideoView('table')}
              aria-label="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button asChild>
            <Link to="/videos/new">
              <Plus className="h-4 w-4" />
              Upload
            </Link>
          </Button>
        </div>
      </div>

      {isError && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        videoView === 'card' ? (
          <CardSkeletonGrid count={pageSize} />
        ) : (
          <TableSkeleton count={pageSize} />
        )
      ) : data && data.items.length === 0 ? (
        <EmptyState />
      ) : videoView === 'card' ? (
        <div
          className={cn(
            'grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3',
            isFetching && 'opacity-60'
          )}
        >
          {data?.items.map((video) => (
            <Card key={video.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <Link to={`/videos/${video.id}`}>
                <VideoThumbnail video={video} className="aspect-video w-full" />
              </Link>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/videos/${video.id}`}
                    className="line-clamp-2 font-semibold leading-snug hover:underline"
                    title={video.title}
                  >
                    {video.title}
                  </Link>
                  <StatusBadge status={video.status} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {getSourceLabel(video.sourceUrl)}
                </p>
                {video.status !== 'completed' && (
                  <div className="space-y-1">
                    <Progress value={video.progressPercent} />
                    <p className="text-right text-xs text-muted-foreground">
                      {video.progressPercent}%
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="gap-2 p-4 pt-0">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link to={`/videos/${video.id}`}>Details</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link to={`/chat/video/${video.id}`}>
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setPendingDelete(video)}
                  aria-label={`Delete ${video.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className={cn('transition-opacity', isFetching && 'opacity-60')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Preview</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Progress</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((video) => (
                <TableRow key={video.id}>
                  <TableCell>
                    <Link to={`/videos/${video.id}`}>
                      <VideoThumbnail
                        video={video}
                        className="aspect-video w-24 rounded-md"
                      />
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <Link
                      to={`/videos/${video.id}`}
                      className="line-clamp-1 font-medium hover:underline"
                      title={video.title}
                    >
                      {video.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {getSourceLabel(video.sourceUrl)}
                    </p>
                    <div className="mt-1 md:hidden">
                      <StatusBadge status={video.status} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <StatusBadge status={video.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Progress value={video.progressPercent} className="w-24" />
                      <span className="text-xs text-muted-foreground">
                        {video.progressPercent}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {formatDate(video.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/videos/${video.id}`}>Details</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link to={`/chat/video/${video.id}`}>Chat</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setPendingDelete(video)}
                        aria-label={`Delete ${video.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this video?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" and all its transcript, summary, chat, and stored files will be permanently removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}

function CardSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <Skeleton className="aspect-video w-full rounded-none" />
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ count }: { count: number }) {
  return (
    <Card className="divide-y">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 p-4">
          <Skeleton className="aspect-video w-24 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Plus className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">No videos yet</p>
          <p className="text-sm text-muted-foreground">
            Upload a URL or media file to start processing.
          </p>
        </div>
        <Button asChild>
          <Link to="/videos/new">Upload your first video</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
