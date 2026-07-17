import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatTimestamp } from '@/lib/utils';

export function TranscriptPage() {
  const { id = '' } = useParams();
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['transcript', id],
    queryFn: () => api.getTranscript(id),
    enabled: Boolean(id)
  });

  const segments = useMemo(() => {
    const all = data?.segments ?? [];
    if (!search.trim()) return all;
    const term = search.toLowerCase();
    return all.filter((segment) => segment.text.toLowerCase().includes(term));
  }, [data?.segments, search]);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to={`/videos/${id}`} aria-label="Back to video">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Transcript</h1>
          <p className="text-sm text-muted-foreground">
            Timestamped segments for retrieval and citations.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transcript..."
          className="pl-9"
        />
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : segments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {search ? 'No segments match your search.' : 'No transcript available yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {segments.map((segment, index) => (
            <Card key={`${segment.startTime}-${index}`}>
              <CardContent className="flex gap-3 p-4">
                <Badge variant="secondary" className="h-fit shrink-0 font-mono">
                  {formatTimestamp(segment.startTime)}
                </Badge>
                <p className="text-sm leading-relaxed">{segment.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
