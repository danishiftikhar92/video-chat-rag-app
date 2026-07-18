import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { ChatRole } from '../enums/index';
import { ChatSession } from './chat-session.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sessionId!: string;

  @ManyToOne(() => ChatSession, (session) => session.messages)
  @JoinColumn({ name: 'sessionId' })
  session!: ChatSession;

  @Column({ type: 'enum', enum: ChatRole })
  role!: ChatRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', default: [] })
  citationsJson!: unknown;

  @CreateDateColumn()
  createdAt!: Date;
}
