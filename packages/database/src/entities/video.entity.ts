import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { SourceType, VideoStatus } from '../enums/index';
import { VideoJob } from './video-job.entity';
import { Transcript } from './transcript.entity';
import { TranscriptChunk } from './transcript-chunk.entity';
import { ChatSession } from './chat-session.entity';
import { Summary } from './summary.entity';

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sourceUrl!: string;

  @Column({ type: 'enum', enum: SourceType })
  sourceType!: SourceType;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  thumbnailUrl!: string | null;

  @Column({ default: 0 })
  durationSeconds!: number;

  @Column({ default: 'unknown' })
  language!: string;

  @Column({ type: 'enum', enum: VideoStatus, default: VideoStatus.queued })
  status!: VideoStatus;

  @Column({ default: 0 })
  progressPercent!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'text', nullable: true })
  sourcePath!: string | null;

  @Column({ type: 'text', nullable: true })
  audioPath!: string | null;

  @Column({ type: 'text', nullable: true })
  transcriptPath!: string | null;

  @Column({ type: 'text', nullable: true })
  summaryPath!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => VideoJob, (job) => job.video)
  jobs!: VideoJob[];

  @OneToOne(() => Transcript, (transcript) => transcript.video)
  transcript!: Transcript;

  @OneToMany(() => TranscriptChunk, (chunk) => chunk.video)
  chunks!: TranscriptChunk[];

  @OneToMany(() => ChatSession, (session) => session.video)
  sessions!: ChatSession[];

  @OneToMany(() => Summary, (summary) => summary.video)
  summaries!: Summary[];
}
