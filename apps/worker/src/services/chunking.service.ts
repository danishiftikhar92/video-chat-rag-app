type TranscriptChunkInput = { text: string; startTime: number; endTime: number };

export class ChunkingService {
  constructor(
    private readonly chunkSize = 800,
    private readonly chunkOverlap = 120
  ) {}

  private splitText(text: string): string[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    if (normalized.length <= this.chunkSize) return [normalized];

    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
      let end = Math.min(start + this.chunkSize, normalized.length);
      if (end < normalized.length) {
        const slice = normalized.slice(start, end);
        const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
        if (lastBreak > this.chunkSize * 0.5) {
          end = start + lastBreak + 1;
        }
      }
      const chunk = normalized.slice(start, end).trim();
      if (chunk) chunks.push(chunk);
      if (end >= normalized.length) break;
      start = Math.max(0, end - this.chunkOverlap);
    }
    return chunks;
  }

  async createChunks(
    videoId: string,
    transcriptId: string,
    segments: TranscriptChunkInput[]
  ) {
    const fullText = segments.map((segment) => segment.text).join(' ');
    const parts = this.splitText(fullText);

    return parts.map((content, index) => {
      const segment = segments[Math.min(index, segments.length - 1)] ?? segments[0];
      return {
        videoId,
        transcriptId,
        chunkIndex: index,
        content,
        startTime: segment?.startTime ?? 0,
        endTime: segment?.endTime ?? 0,
        tokenCount: content.split(/\s+/).filter(Boolean).length,
        metadataJson: { source: 'transcript', segmentIndex: index }
      };
    });
  }
}
