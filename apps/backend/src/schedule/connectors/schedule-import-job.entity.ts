import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ScheduleImportPayload, ScheduleImportSummary } from './schedule-connector';

@Entity('schedule_import_jobs')
@Index('UQ_schedule_import_jobs_tenant_key', ['universityId', 'idempotencyKey'], { unique: true })
@Index('IDX_schedule_import_jobs_poll', ['status', 'nextAttemptAt'])
export class ScheduleImportJob {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) universityId: string;
  @Column({ type: 'uuid' }) actorId: string;
  @Column({ type: 'uuid' }) idempotencyKey: string;
  @Column({ type: 'varchar' }) payloadHash: string;
  @Column({ type: 'varchar', default: 'queued' }) status: 'queued' | 'running' | 'completed' | 'failed';
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'jsonb', nullable: true }) payload: ScheduleImportPayload | null;
  @Column({ type: 'jsonb', nullable: true }) result: ScheduleImportSummary | null;
  @Column({ type: 'varchar', nullable: true }) lastError: string | null;
  @Column({ type: 'uuid', nullable: true }) leaseToken: string | null;
  @Column({ type: 'timestamp', nullable: true }) leaseUntil: Date | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) nextAttemptAt: Date;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
