import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { JsonObject } from '../../common/types/json-value.type';
import { NotificationAction } from './notification.entity';

export const INBOX_ITEM_STATUSES = ['open', 'snoozed', 'done'] as const;
export type InboxItemStatus = (typeof INBOX_ITEM_STATUSES)[number];

@Entity('inbox_items')
@Index('IDX_inbox_items_user_university_status', ['userId', 'universityId', 'status'])
@Index('IDX_inbox_items_event_user', ['eventId', 'userId'])
@Index('UQ_inbox_items_event_user_type', ['eventId', 'userId', 'type'], { unique: true })
export class InboxItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  deepLink: string | null;

  @Column({ type: 'varchar', default: 'normal' })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ type: 'varchar', default: 'open' })
  status: InboxItemStatus;

  @Column({ type: 'timestamp', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  actions: NotificationAction[] | null;

  @Column({ type: 'jsonb', nullable: true })
  data: JsonObject | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
