import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileVideo, Link2, UploadCloud, X } from 'lucide-react';
import { api, type UploadProgress } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const ACCEPT = 'video/*,audio/*,.mp4,.webm,.mkv,.mov,.mp3,.wav,.m4a,.ogg';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function UploadPage() {
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const urlMutation = useMutation({
    mutationFn: api.createVideo,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast.success('Video queued for processing');
      navigate(`/videos/${data.video.id}`);
    },
    onError: (err) => {
      setError((err as Error).message);
      toast.error((err as Error).message);
    }
  });

  const fileMutation = useMutation({
    mutationFn: (file: File) => api.uploadVideo(file, setProgress),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast.success('Upload complete');
      navigate(`/videos/${data.video.id}`);
    },
    onError: (err) => {
      setError((err as Error).message);
      toast.error((err as Error).message);
      setProgress(null);
    }
  });

  const submitUrl = () => {
    setError(null);
    if (!/^https?:\/\//.test(sourceUrl)) {
      setError('Please enter a valid video URL (must start with http:// or https://).');
      return;
    }
    urlMutation.mutate({ sourceUrl });
  };

  const submitFile = () => {
    setError(null);
    if (!selectedFile) {
      setError('Please choose a media file to upload.');
      return;
    }
    setProgress({ loaded: 0, total: selectedFile.size, percent: 0 });
    fileMutation.mutate(selectedFile);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const isUploading = fileMutation.isPending;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Video</h1>
        <p className="text-sm text-muted-foreground">
          Submit a supported URL or upload a local audio/video file for processing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New ingestion</CardTitle>
          <CardDescription>Choose a source to transcribe, embed, and summarize.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="url">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url">
                <Link2 className="h-4 w-4" />
                URL
              </TabsTrigger>
              <TabsTrigger value="file">
                <FileVideo className="h-4 w-4" />
                File Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="source-url">Video URL</Label>
                <Input
                  id="source-url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="text-xs text-muted-foreground">
                  YouTube and direct media links are supported.
                </p>
              </div>
              <Button onClick={submitUrl} disabled={urlMutation.isPending} className="w-full">
                {urlMutation.isPending ? 'Submitting...' : 'Submit URL'}
              </Button>
            </TabsContent>

            <TabsContent value="file" className="space-y-4 pt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
              />

              {!selectedFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/50 hover:bg-accent/50'
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <UploadCloud className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Drag & drop a file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    MP4, WEBM, MKV, MOV, MP3, WAV, M4A, OGG
                  </p>
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FileVideo className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={selectedFile.name}>
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                  {!isUploading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}

              {progress && (
                <div className="space-y-1.5">
                  <Progress value={progress.percent} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                    </span>
                    <span>{progress.percent}%</span>
                  </div>
                </div>
              )}

              <Button
                onClick={submitFile}
                disabled={isUploading || !selectedFile}
                className="w-full"
              >
                {isUploading ? `Uploading... ${progress?.percent ?? 0}%` : 'Upload File'}
              </Button>
            </TabsContent>
          </Tabs>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
