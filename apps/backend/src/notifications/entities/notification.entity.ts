import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { JsonObject } from '../../common/types/json-value.type';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
