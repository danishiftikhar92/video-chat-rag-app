import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { JobStatus } from '../enums/index';
import { Video } from './video.entity';

@Entity('video_jobs')
export class VideoJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  videoId!: string;

  @ManyToOne(() => Video, (video) => video.jobs)
  @JoinColumn({ name: 'videoId' })
  video!: Video;

  @Column()
  jobType!: string;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.queued })
  status!: JobStatus;

  @Column({ default: 0 })
  attemptCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ default: 0 })
  progressPercent!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
