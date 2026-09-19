import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { JsonObject } from '../../common/types/json-value.type';

export interface NotificationAction {
  label: string;
  href: string;
  method?: 'GET' | 'POST' | 'PATCH';
}

export const NOTIFICATION_TYPES = [
  'schedule_change',
  'new_announcement',
  'new_homework',
  'new_file',
  'deadline',
  'absence_decision',
  'new_absence',
  'system',
  'other',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Entity('notifications')
@Index('IDX_notifications_user_university_created_at', [
  'userId',
  'universityId',
  'createdAt',
])
@Index('IDX_notifications_user_university_unread', ['userId', 'universityId'], {
  where: '"isRead" = false',
})
@Index('UQ_notifications_event_user', ['eventId', 'userId'], { unique: true })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({
    type: 'enum',
    enum: NOTIFICATION_TYPES,
    default: 'other',
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ nullable: true })
  deepLink: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  data: JsonObject;

  @Column({ type: 'varchar', default: 'all' })
  category: 'all' | 'important' | 'schedule' | 'homework' | 'teachers' | 'system';

  @Column({ type: 'varchar', default: 'normal' })
  priority: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ type: 'jsonb', nullable: true })
  actions: NotificationAction[] | null;

  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
