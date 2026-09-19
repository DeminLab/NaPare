import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('notification_preferences')
@Index('UQ_notification_preferences_user_university', ['userId', 'universityId'], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ default: true })
  scheduleChanges: boolean;

  @Column({ default: true })
  cancellations: boolean;

  @Column({ default: true })
  roomChanges: boolean;

  @Column({ default: true })
  homeworkCreated: boolean;

  @Column({ default: true })
  deadlines: boolean;

  @Column({ default: true })
  messages: boolean;

  @Column({ default: true })
  announcements: boolean;

  @Column({ default: true })
  systemAlerts: boolean;

  @Column({ default: false })
  quietHoursEnabled: boolean;

  @Column({ type: 'time', nullable: true })
  quietHoursStart: string | null;

  @Column({ type: 'time', nullable: true })
  quietHoursEnd: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
