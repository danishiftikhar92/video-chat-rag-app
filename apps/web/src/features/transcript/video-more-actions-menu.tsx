import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import {
  exportTranscriptMarkdown,
  exportTranscriptPdf,
  toTranscriptExportInput
} from '@/lib/transcript-export';
import type { TranscriptDto } from '@/types/api';

type ExportFormat = 'markdown' | 'pdf';

type VideoMoreActionsMenuProps = {
  videoId: string;
  videoTitle: string;
  transcript?: TranscriptDto;
  canExport?: boolean;
  triggerVariant?: NonNullable<ButtonProps['variant']>;
};

export function VideoMoreActionsMenu({
  videoId,
  videoTitle,
  transcript,
  canExport,
  triggerVariant = 'outline'
}: VideoMoreActionsMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportEnabled = canExport ?? Boolean(transcript?.segments.length || transcript?.rawText.trim());

  const retryMutation = useMutation({
    mutationFn: () => api.retryVideo(videoId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['video', videoId] }),
        queryClient.invalidateQueries({ queryKey: ['videos'] })
      ]);
      toast.success('Reprocessing started');
    },
    onError: (err) => toast.error((err as Error).message)
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteVideo(videoId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['video', videoId] }),
        queryClient.invalidateQueries({ queryKey: ['videos'] })
      ]);
      toast.success('Video deleted');
      navigate('/videos');
    },
    onError: (err) => toast.error((err as Error).message)
  });

  const handleExport = async (format: ExportFormat) => {
    if (!exportEnabled || isExporting) return;

    try {
      setIsExporting(true);
      const transcriptData =
        transcript ??
        (await queryClient.fetchQuery({
          queryKey: ['transcript', videoId],
          queryFn: () => api.getTranscript(videoId)
        }));
      if (!transcriptData) {
        throw new Error('No transcript available to export');
      }

      const exportInput = toTranscriptExportInput(transcriptData, videoTitle);
      if (format === 'markdown') {
        exportTranscriptMarkdown(exportInput);
      } else {
        exportTranscriptPdf(exportInput);
      }

      toast.success(format === 'markdown' ? 'Transcript exported as Markdown' : 'Transcript exported as PDF');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={triggerVariant}
            disabled={retryMutation.isPending || deleteMutation.isPending}
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
            More actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}>
            Retry
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExport('markdown')} disabled={!exportEnabled || isExporting}>
            Export Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleExport('pdf')} disabled={!exportEnabled || isExporting}>
            Export PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
            className="text-destructive focus:text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this video?"
        description={`"${videoTitle}" and all its transcript, summary, chat, and stored files will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
