import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Video } from './video.entity';
import { Transcript } from './transcript.entity';

const DEFAULT_EMBEDDING_DIMENSIONS = 384;

const parseVector = (value: unknown): number[] | null => {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!cleaned) return null;
  return cleaned.split(',').map((part) => Number(part.trim()));
};

const formatVector = (value: number[] | null): string | null => {
  if (value == null) return null;
  return `[${value.join(',')}]`;
};

const embeddingDimensions = () => {
  const raw = process.env.EMBEDDING_DIMENSIONS;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_EMBEDDING_DIMENSIONS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EMBEDDING_DIMENSIONS;
};

@Entity('transcript_chunks')
@Index(['videoId', 'chunkIndex'])
export class TranscriptChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  videoId!: string;

  @ManyToOne(() => Video, (video) => video.chunks)
  @JoinColumn({ name: 'videoId' })
  video!: Video;

  @Column()
  transcriptId!: string;

  @ManyToOne(() => Transcript, (transcript) => transcript.chunks)
  @JoinColumn({ name: 'transcriptId' })
  transcript!: Transcript;

  @Column()
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'float' })
  startTime!: number;

  @Column({ type: 'float' })
  endTime!: number;

  @Column()
  tokenCount!: number;

  @Column({ type: 'text', nullable: true })
  embeddingId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson!: Record<string, unknown> | null;

  /**
   * pgvector column. Dimensions must match OLLAMA_EMBED_MODEL / EMBEDDING_DIMENSIONS.
   */
  @Column({
    type: 'vector',
    length: embeddingDimensions(),
    nullable: true,
    transformer: {
      to: (value: number[] | null) => formatVector(value),
      from: (value: unknown) => parseVector(value)
    }
  })
  embedding!: number[] | null;

  @CreateDateColumn()
  createdAt!: Date;
}
