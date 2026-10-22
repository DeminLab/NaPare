import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleImportJobs1700000000033 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE lessons ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL');
    await runner.query(`CREATE TABLE IF NOT EXISTS schedule_import_jobs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "universityId" uuid NOT NULL, "actorId" uuid NOT NULL,
      "idempotencyKey" uuid NOT NULL, "payloadHash" varchar NOT NULL, status varchar NOT NULL DEFAULT 'queued',
      attempts integer NOT NULL DEFAULT 0, payload jsonb NULL, result jsonb NULL, "lastError" varchar NULL,
      "leaseToken" uuid NULL, "leaseUntil" timestamp NULL, "nextAttemptAt" timestamp NOT NULL DEFAULT now(),
      "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
    )`);
    await runner.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_schedule_import_jobs_tenant_key" ON schedule_import_jobs ("universityId", "idempotencyKey")');
    await runner.query('CREATE INDEX IF NOT EXISTS "IDX_schedule_import_jobs_poll" ON schedule_import_jobs (status, "nextAttemptAt")');
    // Integration with tenant RLS (migration 29) must reapply the tenant policy helper
    // after creating this table; see docs/integrations/schedule-import.md.
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE schedule_import_jobs');
    await runner.query('ALTER TABLE lessons DROP COLUMN "deletedAt"');
  }
}
