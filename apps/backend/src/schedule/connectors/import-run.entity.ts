import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ImportRollbackResult, ScheduleImportPlan, SCHEDULE_MAPPING_VERSION } from './schedule-connector';

/**
 * TZ FR-IMP-05: one durable row per import attempt. `mode` distinguishes the
 * server dry-run from a real apply; `fileHash` is the sha256 of the source
 * file (NULL only for configured external connectors without a file);
 * `result` keeps the per-row outcomes/warnings/errors; `rolledBackAt` and
 * `rollbackResult` hold the compensating-rollback state (30-day window).
 */
@Entity('import_runs')
@Index('IDX_import_runs_organization_created', ['organizationId', 'createdAt'])
@Index('UQ_import_runs_job', ['jobId'], { unique: true, where: '"jobId" IS NOT NULL' })
export class ImportRun {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organizationId: string;
  @Column({ type: 'uuid' }) actorId: string;
  /** NULL for dry-runs: they never create a queue job. */
  @Column({ type: 'uuid', nullable: true }) jobId: string | null;
  @Column({ type: 'varchar' }) mode: 'dry-run' | 'apply';
  @Column({ type: 'varchar', default: 'completed' }) status: 'queued' | 'completed' | 'failed';
  /** sha256 of the uploaded file content; NULL for external connectors. */
  @Column({ type: 'varchar', nullable: true }) fileHash: string | null;
  /** Reference to a protected file copy; NULL while organization storage policy is not configured. */
  @Column({ type: 'varchar', nullable: true }) fileRef: string | null;
  @Column({ type: 'varchar', default: SCHEDULE_MAPPING_VERSION }) mappingVersion: string;
  @Column({ type: 'varchar' }) payloadHash: string;
  @Column({ type: 'varchar' }) source: string;
  @Column({ type: 'varchar' }) fileName: string;
  @Column({ type: 'jsonb', nullable: true }) result: ScheduleImportPlan | null;
  @Column({ type: 'varchar', nullable: true }) lastError: string | null;
  @Column({ type: 'timestamp', nullable: true }) completedAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) rolledBackAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) rolledBackBy: string | null;
  @Column({ type: 'jsonb', nullable: true }) rollbackResult: ImportRollbackResult | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
