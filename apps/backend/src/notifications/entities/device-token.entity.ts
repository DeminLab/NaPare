import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DeviceProvider } from '../delivery/push-providers';

export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

@Entity('device_tokens')
@Index('UQ_device_tokens_token', ['token'], { unique: true })
@Index('IDX_device_tokens_user_active', ['userId', 'isActive'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  token: string;

  @Column({ type: 'varchar', length: 16, default: 'legacy' })
  provider: DeviceProvider;

  @Column({
    type: 'enum',
    enum: DEVICE_PLATFORMS,
  })
  platform: DevicePlatform;

  @Column({ nullable: true })
  deviceName?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column('timestamp', { nullable: true }) webPushConsentedAt: Date | null;
  @Column('varchar', { nullable: true }) webPushConsentVersion: string | null;
  @Column('timestamp', { nullable: true }) webPushRevokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
