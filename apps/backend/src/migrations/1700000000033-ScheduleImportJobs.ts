import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantRowSecurity1700000000029 } from './1700000000029-TenantRowSecurity';

export class ScheduleImportJobs1700000000033 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE lessons ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL');
    await runner.query(`CREATE TABLE IF NOT EXISTS schedule_import_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL REFERENCES universities(id), "actorId" uuid NOT NULL REFERENCES users(id),
      "idempotencyKey" uuid NOT NULL, "payloadHash" varchar NOT NULL, status varchar NOT NULL DEFAULT 'queued',
      attempts integer NOT NULL DEFAULT 0, payload jsonb NULL, result jsonb NULL, "lastError" varchar NULL,
      "nextAttemptAt" timestamp NOT NULL DEFAULT now(),
      "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
    )`);
    await runner.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_schedule_import_jobs_tenant_key" ON schedule_import_jobs ("universityId", "idempotencyKey")');
    await runner.query('CREATE INDEX IF NOT EXISTS "IDX_schedule_import_jobs_poll" ON schedule_import_jobs (status, "nextAttemptAt")');
    await runner.query("ALTER TABLE schedule_import_jobs ADD CONSTRAINT schedule_import_status CHECK (status IN ('queued', 'completed', 'failed'))");
    await new TenantRowSecurity1700000000029().up(runner);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE schedule_import_jobs');
    await runner.query('ALTER TABLE lessons DROP COLUMN "deletedAt"');
  }
}
