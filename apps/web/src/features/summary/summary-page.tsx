import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTimestamp } from '@/lib/utils';

export function SummaryPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['summary', id],
    queryFn: () => api.getSummary(id),
    enabled: Boolean(id)
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to={`/videos/${id}`} aria-label="Back to video">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Summary</h1>
          <p className="text-sm text-muted-foreground">Key takeaways and highlights.</p>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {data?.summaryText || 'No summary available yet.'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : data?.highlights.length ? (
              data.highlights.map((highlight, index) => (
                <div key={index} className="border-l-2 border-primary pl-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{highlight.title}</p>
                    {highlight.startTime !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(highlight.startTime)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{highlight.detail}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No highlights extracted.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
