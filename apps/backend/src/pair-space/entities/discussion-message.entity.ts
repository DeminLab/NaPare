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

@Entity('discussion_messages')
@Index('IDX_discussion_messages_pair_space_created_at', [
  'pairSpaceId',
  'createdAt',
])
export class DiscussionMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pairSpaceId: string;

  @ManyToOne(() => PairSpace)
  @JoinColumn({ name: 'pairSpaceId' })
  pairSpace: PairSpace;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string;

  @Column({ type: 'varchar', default: 'visible' })
  moderationState: 'visible' | 'hidden';

  @Column({ type: 'text', nullable: true })
  moderationReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  moderatedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  moderatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
