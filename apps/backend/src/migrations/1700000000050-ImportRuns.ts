import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TZ 9.3 import traceability (FR-IMP-04/05/07/08): `import_runs` and the
 * university-wide mass-change confirmation threshold.
 *
 *  - `import_runs` is the auditable journal of one import attempt: the sha256
 *    of the uploaded file, the mapping version, the protected-copy reference
 *    when a storage policy exists, the dry-run flag, the terminal result and
 *    the per-row outcomes (FR-IMP-05). One run per import job, so apply and
 *    the later compensating rollback share one identity;
 *  - `universities."importMassChangeThreshold"` is the org-configurable 0..100
 *    percentage above which a schedule import must be confirmed explicitly
 *    (FR-IMP-08); 100 disables only the mass-change gate — an empty snapshot
 *    is always gated;
 *  - the table gets FORCE row security with the migration-29 policy shape and
 *    the migration-38 active-writer trigger: startup `assertTenantDatabase`
 *    rejects any organizationId table without exactly these four restrictive
 *    policies.
 *
 * Idempotent: CREATE ... IF NOT EXISTS, DROP POLICY IF EXISTS and guarded
 * ALTER, so dev/test may execute it after synchronize (which already created
 * the table from the entity metadata). Reversible: down() drops the journal
 * table (import history authored by the platform, no legacy shape to restore)
 * and the threshold column (default returns).
 */
export class ImportRuns1700000000050 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "import_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL REFERENCES universities(id),
        "actorId" uuid REFERENCES users(id) ON DELETE SET NULL,
        "jobId" uuid REFERENCES schedule_import_jobs(id) ON DELETE SET NULL,
        "source" varchar NOT NULL,
        "fileName" varchar NOT NULL,
        "fileHash" varchar,
        "fileRef" varchar,
        "mappingVersion" varchar NOT NULL,
        "payloadHash" varchar NOT NULL,
        "mode" varchar NOT NULL CONSTRAINT "CHK_import_runs_mode" CHECK ("mode" IN ('dry-run', 'apply')),
        "status" varchar NOT NULL DEFAULT 'completed' CONSTRAINT "CHK_import_runs_status" CHECK ("status" IN ('queued', 'completed', 'failed')),
        "result" jsonb,
        "lastError" text,
        "rolledBackAt" timestamptz,
        "rolledBackBy" uuid REFERENCES users(id) ON DELETE SET NULL,
        "rollbackResult" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "completedAt" timestamptz
      );
      CREATE INDEX IF NOT EXISTS "IDX_import_runs_organization_created"
        ON "import_runs" ("organizationId", "createdAt" DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_import_runs_job"
        ON "import_runs" ("jobId") WHERE "jobId" IS NOT NULL;
    `);

    // FR-IMP-08: threshold per university; 0..100, 100 disables only the
    // mass-change gate (an empty file/snapshot stays confirmable regardless).
    await queryRunner.query(`
      ALTER TABLE "universities"
        ADD COLUMN IF NOT EXISTS "importMassChangeThreshold" integer NOT NULL DEFAULT 30;
      ALTER TABLE "universities"
        DROP CONSTRAINT IF EXISTS "CHK_universities_import_mass_change_threshold";
      ALTER TABLE "universities"
        ADD CONSTRAINT "CHK_universities_import_mass_change_threshold"
        CHECK ("importMassChangeThreshold" BETWEEN 0 AND 100);
    `);

    await queryRunner.query(`
      ALTER TABLE "import_runs" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "import_runs" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS napare_tenant_base ON "import_runs";
      DROP POLICY IF EXISTS napare_tenant_select ON "import_runs";
      DROP POLICY IF EXISTS napare_tenant_insert ON "import_runs";
      DROP POLICY IF EXISTS napare_tenant_update ON "import_runs";
      DROP POLICY IF EXISTS napare_tenant_delete ON "import_runs";
      CREATE POLICY napare_tenant_base ON "import_runs" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY napare_tenant_select ON "import_runs" AS RESTRICTIVE FOR SELECT
        USING (public.napare_tenant_allows('import_runs', "organizationId"::text, false));
      CREATE POLICY napare_tenant_insert ON "import_runs" AS RESTRICTIVE FOR INSERT
        WITH CHECK (public.napare_tenant_allows('import_runs', "organizationId"::text, true));
      CREATE POLICY napare_tenant_update ON "import_runs" AS RESTRICTIVE FOR UPDATE
        USING (public.napare_tenant_allows('import_runs', "organizationId"::text, false))
        WITH CHECK (public.napare_tenant_allows('import_runs', "organizationId"::text, true));
      CREATE POLICY napare_tenant_delete ON "import_runs" AS RESTRICTIVE FOR DELETE
        USING (public.napare_tenant_allows('import_runs', "organizationId"::text, true));
    `);

    // Same active-account guard as the migration-38..44 tables; the function
    // exists from migration 38, which always precedes this file.
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS napare_active_writer ON "import_runs";
      CREATE TRIGGER napare_active_writer BEFORE INSERT OR UPDATE OR DELETE ON "import_runs"
        FOR EACH ROW EXECUTE FUNCTION public.napare_check_active_writer();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "import_runs";`);
    await queryRunner.query(`
      ALTER TABLE "universities" DROP CONSTRAINT IF EXISTS "CHK_universities_import_mass_change_threshold";
      ALTER TABLE "universities" DROP COLUMN IF EXISTS "importMassChangeThreshold";
    `);
  }
}
