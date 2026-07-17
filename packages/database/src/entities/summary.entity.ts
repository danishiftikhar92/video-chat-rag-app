import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { Video } from './video.entity';

@Entity('summaries')
export class Summary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  videoId!: string;

  @ManyToOne(() => Video, (video) => video.summaries)
  @JoinColumn({ name: 'videoId' })
  video!: Video;

  @Column({ type: 'text' })
  summaryText!: string;

  @Column({ type: 'jsonb' })
  highlightsJson!: unknown;

  @CreateDateColumn()
  createdAt!: Date;
}
