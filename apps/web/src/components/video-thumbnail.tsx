import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import type { VideoDto } from '@video-rag/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, getYouTubeThumbnail } from '@/lib/utils';

function resolveThumbnail(video: Pick<VideoDto, 'thumbnailUrl' | 'sourceUrl'>): string | null {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  return getYouTubeThumbnail(video.sourceUrl);
}

interface VideoThumbnailProps {
  video: Pick<VideoDto, 'thumbnailUrl' | 'sourceUrl' | 'title'>;
  className?: string;
}

export function VideoThumbnail({ video, className }: VideoThumbnailProps) {
  const src = resolveThumbnail(video);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');

  useEffect(() => {
    setStatus(src ? 'loading' : 'error');
  }, [src]);

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {status === 'loading' && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
      {status === 'error' || !src ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
          <Film className="h-8 w-8 text-muted-foreground/50" />
        </div>
      ) : (
        <img
          src={src}
          alt={video.title}
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </div>
  );
}
