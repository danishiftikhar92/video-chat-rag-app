import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { Video } from './video.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  videoId!: string | null;

  @ManyToOne(() => Video, (video) => video.sessions, { nullable: true })
  @JoinColumn({ name: 'videoId' })
  video!: Video | null;

  @Column({ type: 'text', nullable: true })
  anonymousId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ChatMessage, (message) => message.session)
  messages!: ChatMessage[];
}
