import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

import { JsonObject } from '../common/types/json-value.type';

export type TelemetrySource = 'backend' | 'web' | 'android' | 'max' | 'api';
export type TelemetryCategory = 'auth' | 'request' | 'error' | 'ui' | 'admin' | 'system';
export type TelemetrySeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type AuthEventType = 'login_success' | 'login_failed' | 'logout' | 'logout_all';

@Entity('user_sessions')
@Index('IDX_user_sessions_user_created', ['userId', 'createdAt'])
@Index('IDX_user_sessions_scope_seen', ['universityId', 'lastSeenAt'])
export class UserSession {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column('uuid', { nullable: true }) universityId: string | null;
  @Column({ type: 'varchar', default: 'web' }) client: string;
  @Column({ type: 'varchar', default: 'unknown' }) device: string;
  @Column({ type: 'varchar', default: 'unknown' }) os: string;
  @Column({ type: 'varchar', default: 'unknown' }) browser: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip: string | null;
  @Column({ type: 'varchar', length: 512, nullable: true }) userAgent: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) lastSeenAt: Date;
  @Column({ type: 'timestamp' }) expiresAt: Date;
  @Column({ type: 'timestamp', nullable: true }) revokedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) revokedBy: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) revokeReason: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: JsonObject | null;
}

@Entity('auth_events')
@Index('IDX_auth_events_created', ['createdAt'])
@Index('IDX_auth_events_user_created', ['userId', 'createdAt'])
@Index('IDX_auth_events_type_created', ['type', 'createdAt'])
export class AuthEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { nullable: true }) userId: string | null;
  @Column('uuid', { nullable: true }) universityId: string | null;
  @Column({ type: 'varchar' }) type: AuthEventType;
  @Column({ type: 'varchar', length: 64, nullable: true }) emailHash: string | null;
  @Column('uuid', { nullable: true }) sessionId: string | null;
  @Column({ type: 'varchar', default: 'web' }) client: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip: string | null;
  @Column({ type: 'varchar', length: 512, nullable: true }) userAgent: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: JsonObject | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date;
}

@Entity('platform_events')
@Index('IDX_platform_events_created', ['createdAt'])
@Index('IDX_platform_events_scope_created', ['universityId', 'createdAt'])
@Index('IDX_platform_events_category_created', ['category', 'createdAt'])
@Index('IDX_platform_events_user_created', ['userId', 'createdAt'])
@Index('IDX_platform_events_name_created', ['name', 'createdAt'])
export class PlatformEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', default: 'backend' }) source: TelemetrySource;
  @Column({ type: 'varchar', default: 'system' }) category: TelemetryCategory;
  @Column({ type: 'varchar' }) name: string;
  @Column({ type: 'varchar', default: 'info' }) severity: TelemetrySeverity;
  @Column('uuid', { nullable: true }) userId: string | null;
  @Column('uuid', { nullable: true }) universityId: string | null;
  @Column('uuid', { nullable: true }) sessionId: string | null;
  @Column({ type: 'varchar', length: 12, nullable: true }) method: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) path: string | null;
  @Column({ type: 'integer', nullable: true }) statusCode: number | null;
  @Column({ type: 'integer', nullable: true }) durationMs: number | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip: string | null;
  @Column({ type: 'varchar', length: 512, nullable: true }) userAgent: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: JsonObject | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date;
}
