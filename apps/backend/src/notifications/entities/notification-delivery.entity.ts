import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DeliveryChannel } from '../delivery/push-providers';

export type DeliveryStatus = 'pending' | 'queued' | 'sending' | 'delivered' | 'suppressed' | 'dead';

@Entity('notification_deliveries')
@Index('UQ_notification_delivery_target', ['notificationId', 'channel', 'targetId'], { unique: true })
@Index('IDX_notification_delivery_dispatch', ['status', 'updatedAt'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) universityId: string;
  @Column({ type: 'uuid' }) notificationId: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 16 }) channel: DeliveryChannel;
  @Column({ type: 'uuid' }) targetId: string;
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status: DeliveryStatus;
  @Column({ default: 0 }) attempts: number;
  @Column({ type: 'varchar', length: 64, nullable: true }) lastError: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) history: Array<{ at: string; status: DeliveryStatus; attempt: number; error?: string }>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
