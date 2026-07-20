import { jsPDF } from 'jspdf';
import type { TranscriptDto, TranscriptSegment } from '@/types/api';
import { formatTimestamp } from '@/lib/utils';

type TranscriptExportInput = {
  videoId: string;
  title: string;
  language: string;
  rawText: string;
  segments: TranscriptSegment[];
};

function buildTimestampedLine(segment: TranscriptSegment): string {
  const speakerPrefix = segment.speaker ? `${segment.speaker}: ` : '';
  return `[${formatTimestamp(segment.startTime)}] ${speakerPrefix}${segment.text}`;
}

export function sanitizeFilename(title: string, videoId: string): string {
  const normalized = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `transcript-${videoId}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildTranscriptMarkdown({
  title,
  language,
  rawText,
  segments
}: Omit<TranscriptExportInput, 'videoId'>): string {
  const lines = [`# ${title}`, '', `- Language: ${language}`, `- Exported: ${new Date().toLocaleString()}`, ''];

  if (segments.length > 0) {
    lines.push('## Transcript', '');
    for (const segment of segments) {
      const speakerPrefix = segment.speaker ? `${segment.speaker}: ` : '';
      lines.push(`- **[${formatTimestamp(segment.startTime)}]** ${speakerPrefix}${segment.text}`);
    }
  } else if (rawText.trim()) {
    lines.push('## Transcript', '', rawText.trim());
  } else {
    lines.push('No transcript available.');
  }

  return lines.join('\n');
}

export function exportTranscriptMarkdown(input: TranscriptExportInput): void {
  const markdown = buildTranscriptMarkdown(input);
  const filename = `${sanitizeFilename(input.title, input.videoId)}.md`;
  downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), filename);
}

export function exportTranscriptPdf({
  videoId,
  title,
  language,
  rawText,
  segments
}: TranscriptExportInput): void {
  const doc = new jsPDF({ format: 'a4', unit: 'pt' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - margin;
  let cursorY = margin;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= bottomLimit) return;
    doc.addPage();
    cursorY = margin;
  };

  const writeBlock = (text: string, fontSize = 11) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * 1.5;
    ensureSpace(lines.length * lineHeight);
    doc.text(lines, margin, cursorY);
    cursorY += lines.length * lineHeight + 8;
  };

  doc.setFontSize(18);
  doc.text(title, margin, cursorY);
  cursorY += 24;

  writeBlock(`Language: ${language}`, 11);
  writeBlock(`Exported: ${new Date().toLocaleString()}`, 11);
  cursorY += 8;

  if (segments.length > 0) {
    for (const segment of segments) {
      writeBlock(buildTimestampedLine(segment), 11);
    }
  } else if (rawText.trim()) {
    for (const paragraph of rawText.trim().split(/\n{2,}/)) {
      writeBlock(paragraph.replace(/\s*\n\s*/g, ' '), 11);
    }
  } else {
    writeBlock('No transcript available.', 11);
  }

  doc.save(`${sanitizeFilename(title, videoId)}.pdf`);
}

export function toTranscriptExportInput(
  transcript: TranscriptDto,
  title: string
): TranscriptExportInput {
  return {
    videoId: transcript.videoId,
    title,
    language: transcript.language,
    rawText: transcript.rawText,
    segments: transcript.segments
  };
}
