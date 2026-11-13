import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TZ 11.2/11.3 expand step: the academic calendar behind
 * `GET /schedule/week-type`.
 *
 *  - `academic_term` stores the semester rule the TZ 11.3 formula evaluates:
 *    the Monday of week 1 (`week1Anchor`), its parity (`week1Type`) and the
 *    cycle length (`cycleLength`);
 *  - `calendar_exception` holds manual overrides per date or week number,
 *    optionally scoped to a group/faculty for a later endpoint parameter;
 *  - both tables get FORCE row security with the migration-29 policy shape:
 *    the startup `assertTenantDatabase` invariant rejects any organizationId
 *    table without exactly these four restrictive policies.
 *
 * Idempotent: CREATE ... IF NOT EXISTS and DROP POLICY IF EXISTS, so dev/test
 * may execute it after synchronize (which already created the tables from the
 * entity metadata). Reversible: down() drops the two new tables; they hold
 * configuration authored after the expand step, so there is no legacy shape
 * to restore.
 */
export class AcademicTerm1700000000048 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "academic_term" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL REFERENCES universities(id),
        "startsOn" date NOT NULL,
        "endsOn" date NOT NULL,
        "cycleLength" integer NOT NULL CONSTRAINT "CHK_academic_term_cycle_length" CHECK ("cycleLength" >= 1),
        "week1Anchor" date NOT NULL,
        "week1Type" varchar NOT NULL CONSTRAINT "CHK_academic_term_week1_type" CHECK ("week1Type" IN ('odd','even')),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_academic_term_organization_starts" UNIQUE ("organizationId", "startsOn"),
        CONSTRAINT "CHK_academic_term_range" CHECK ("endsOn" >= "startsOn")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_exception" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL REFERENCES universities(id),
        "exceptionDate" date,
        "weekNumber" integer CONSTRAINT "CHK_calendar_exception_week_number" CHECK ("weekNumber" IS NULL OR "weekNumber" >= 1),
        "weekType" varchar CONSTRAINT "CHK_calendar_exception_week_type" CHECK ("weekType" IS NULL OR "weekType" IN ('odd','even')),
        "kind" varchar,
        "groupId" uuid REFERENCES groups(id) ON DELETE CASCADE,
        "facultyId" uuid REFERENCES faculties(id) ON DELETE CASCADE,
        "note" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_calendar_exception_target" CHECK ("exceptionDate" IS NOT NULL OR "weekNumber" IS NOT NULL)
      );
      CREATE INDEX IF NOT EXISTS "IDX_calendar_exception_org_date"
        ON "calendar_exception" ("organizationId", "exceptionDate");
      CREATE INDEX IF NOT EXISTS "IDX_calendar_exception_org_week"
        ON "calendar_exception" ("organizationId", "weekNumber");
    `);

    await queryRunner.query(`
      ALTER TABLE "academic_term" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "academic_term" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS napare_tenant_base ON "academic_term";
      DROP POLICY IF EXISTS napare_tenant_select ON "academic_term";
      DROP POLICY IF EXISTS napare_tenant_insert ON "academic_term";
      DROP POLICY IF EXISTS napare_tenant_update ON "academic_term";
      DROP POLICY IF EXISTS napare_tenant_delete ON "academic_term";
      CREATE POLICY napare_tenant_base ON "academic_term" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY napare_tenant_select ON "academic_term" AS RESTRICTIVE FOR SELECT
        USING (public.napare_tenant_allows('academic_term', "organizationId"::text, false));
      CREATE POLICY napare_tenant_insert ON "academic_term" AS RESTRICTIVE FOR INSERT
        WITH CHECK (public.napare_tenant_allows('academic_term', "organizationId"::text, true));
      CREATE POLICY napare_tenant_update ON "academic_term" AS RESTRICTIVE FOR UPDATE
        USING (public.napare_tenant_allows('academic_term', "organizationId"::text, false))
        WITH CHECK (public.napare_tenant_allows('academic_term', "organizationId"::text, true));
      CREATE POLICY napare_tenant_delete ON "academic_term" AS RESTRICTIVE FOR DELETE
        USING (public.napare_tenant_allows('academic_term', "organizationId"::text, true));
    `);

    await queryRunner.query(`
      ALTER TABLE "calendar_exception" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "calendar_exception" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS napare_tenant_base ON "calendar_exception";
      DROP POLICY IF EXISTS napare_tenant_select ON "calendar_exception";
      DROP POLICY IF EXISTS napare_tenant_insert ON "calendar_exception";
      DROP POLICY IF EXISTS napare_tenant_update ON "calendar_exception";
      DROP POLICY IF EXISTS napare_tenant_delete ON "calendar_exception";
      CREATE POLICY napare_tenant_base ON "calendar_exception" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY napare_tenant_select ON "calendar_exception" AS RESTRICTIVE FOR SELECT
        USING (public.napare_tenant_allows('calendar_exception', "organizationId"::text, false));
      CREATE POLICY napare_tenant_insert ON "calendar_exception" AS RESTRICTIVE FOR INSERT
        WITH CHECK (public.napare_tenant_allows('calendar_exception', "organizationId"::text, true));
      CREATE POLICY napare_tenant_update ON "calendar_exception" AS RESTRICTIVE FOR UPDATE
        USING (public.napare_tenant_allows('calendar_exception', "organizationId"::text, false))
        WITH CHECK (public.napare_tenant_allows('calendar_exception', "organizationId"::text, true));
      CREATE POLICY napare_tenant_delete ON "calendar_exception" AS RESTRICTIVE FOR DELETE
        USING (public.napare_tenant_allows('calendar_exception', "organizationId"::text, true));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_exception";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "academic_term";`);
  }
}
