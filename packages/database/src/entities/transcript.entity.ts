import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Video } from './video.entity';
import { TranscriptChunk } from './transcript-chunk.entity';

@Entity('transcripts')
export class Transcript {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  videoId!: string;

  @OneToOne(() => Video, (video) => video.transcript)
  @JoinColumn({ name: 'videoId' })
  video!: Video;

  @Column({ type: 'text' })
  rawText!: string;

  @Column({ type: 'jsonb' })
  segmentsJson!: unknown;

  @Column()
  language!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => TranscriptChunk, (chunk) => chunk.transcript)
  chunks!: TranscriptChunk[];
}
