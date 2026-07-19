import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { GuardRailDirection, GuardRailType } from '../enums/index';

export type GuardRailConfig = {
  patterns?: string[];
  keywords?: string[];
  allowKeywords?: string[];
  denyKeywords?: string[];
  refusalMessage?: string;
};

@Entity('guard_rails')
export class GuardRail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: GuardRailType })
  type!: GuardRailType;

  @Column({ type: 'enum', enum: GuardRailDirection })
  direction!: GuardRailDirection;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ type: 'jsonb', default: {} })
  config!: GuardRailConfig;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
