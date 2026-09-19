import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { PairSpace } from './pair-space.entity';

@Entity('homeworks')
@Index('IDX_homeworks_pair_space_deadline', ['pairSpaceId', 'deadline'])
export class Homework {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pairSpaceId: string;

  @ManyToOne(() => PairSpace, (pairSpace) => pairSpace.homeworks)
  @JoinColumn({ name: 'pairSpaceId' })
  pairSpace: PairSpace;

  @Column({ type: 'uuid' })
  authorId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ default: false })
  isRecurring: boolean;

  @Column({ nullable: true })
  recurringRule: string;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ nullable: true })
  source: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ nullable: true })
  sourceVersion: string | null;

  @Column({ type: 'varchar', default: 'unknown' })
  syncStatus: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
