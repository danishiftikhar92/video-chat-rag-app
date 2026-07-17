import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TranscriptChunk } from '@video-rag/database';
import { createOllamaClientFromEnv, toPgVectorLiteral } from '@video-rag/shared';
import { Repository } from 'typeorm';
import { getEnv } from '../../config/env';

type RetrievedChunk = {
  id: string;
  videoId: string;
  content: string;
  startTime: number;
  endTime: number;
  score: number;
  metadata: unknown;
};

@Injectable()
export class RagService {
  private readonly ollama = createOllamaClientFromEnv(getEnv());

  constructor(
    @InjectRepository(TranscriptChunk) private readonly chunkRepo: Repository<TranscriptChunk>
  ) {}

  async retrieveRelevantChunks(videoIds: string[], query: string): Promise<RetrievedChunk[]> {
    if (videoIds.length === 0) return [];

    const queryEmbedding = await this.ollama.embedOne(query);
    const expectedDims = Number.parseInt(getEnv().EMBEDDING_DIMENSIONS, 10) || 384;
    if (queryEmbedding.length !== expectedDims) {
      throw new Error(
        `Query embedding dimension mismatch: got ${queryEmbedding.length}, expected ${expectedDims}`
      );
    }

    const vectorLiteral = toPgVectorLiteral(queryEmbedding);
    const rows = (await this.chunkRepo.query(
      `
        SELECT
          id,
          "videoId",
          content,
          "startTime",
          "endTime",
          "metadataJson",
          (embedding <=> $1::vector) AS distance
        FROM transcript_chunks
        WHERE "videoId" = ANY($2::uuid[])
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 5
      `,
      [vectorLiteral, videoIds]
    )) as Array<{
      id: string;
      videoId: string;
      content: string;
      startTime: number;
      endTime: number;
      metadataJson: unknown;
      distance: string | number;
    }>;

    return rows.map((row) => {
      const distance = Number(row.distance);
      const score = Number.isFinite(distance) ? 1 / (1 + distance) : 0;
      return {
        id: row.id,
        videoId: row.videoId,
        content: row.content,
        startTime: Number(row.startTime),
        endTime: Number(row.endTime),
        score,
        metadata: row.metadataJson
      };
    });
  }

  gradeContext(chunks: Array<{ score: number }>) {
    if (chunks.length === 0) return 'none';
    const topScore = chunks[0]?.score ?? 0;
    // score = 1/(1+cosine_distance). Calibrated for all-MiniLM: strong matches land
    // ~0.65-0.70 (distance ~0.45-0.55), moderate ~0.55 (distance ~0.8), and
    // near-orthogonal noise ~0.5 (distance ~1.0).
    if (topScore >= 0.62) return 'high';
    if (topScore >= 0.52) return 'low';
    return 'none';
  }
}
