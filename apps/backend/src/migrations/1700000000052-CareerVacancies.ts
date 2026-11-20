import { MigrationInterface, QueryRunner } from 'typeorm';

export class CareerVacancies1700000000052 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS career_vacancy (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL, "companyId" uuid NOT NULL,
        title varchar(160) NOT NULL, description text NOT NULL, kind varchar NOT NULL,
        status varchar NOT NULL DEFAULT 'pending', "reviewReason" text NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_career_vacancy_status" CHECK (status IN ('pending','open','rejected','closed')),
        CONSTRAINT "CHK_career_vacancy_kind" CHECK (kind IN ('job','internship'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_career_vacancy_scope" ON career_vacancy(id,"organizationId","companyId");
      CREATE INDEX IF NOT EXISTS "IDX_career_vacancy_catalog" ON career_vacancy("organizationId",status,"createdAt");
      CREATE INDEX IF NOT EXISTS "IDX_career_vacancy_company" ON career_vacancy("companyId","createdAt");

      CREATE TABLE IF NOT EXISTS career_vacancy_application (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL, "companyId" uuid NOT NULL, "vacancyId" uuid NOT NULL, "studentId" uuid NOT NULL,
        resume jsonb NOT NULL, status varchar NOT NULL DEFAULT 'submitted',
        "startsAt" timestamptz, "endsAt" timestamptz, "meetingDetails" text NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_career_vacancy_application_status" CHECK (status IN ('submitted','proposed','confirmed','declined')),
        CONSTRAINT "CHK_career_vacancy_interview_window" CHECK (
          ("startsAt" IS NULL AND "endsAt" IS NULL AND status = 'submitted') OR
          ("startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt" AND status <> 'submitted'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_career_vacancy_applicant" ON career_vacancy_application("vacancyId","studentId");
      CREATE INDEX IF NOT EXISTS "IDX_career_vacancy_student_interviews" ON career_vacancy_application("studentId",status,"startsAt");

      DO $constraints$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_career_vacancy_company' AND conrelid='career_vacancy'::regclass) THEN
          ALTER TABLE career_vacancy ADD CONSTRAINT "FK_career_vacancy_company" FOREIGN KEY ("companyId") REFERENCES career_company(id);
          ALTER TABLE career_vacancy ADD CONSTRAINT "FK_career_vacancy_university" FOREIGN KEY ("organizationId") REFERENCES universities(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_career_vacancy_application_scope' AND conrelid='career_vacancy_application'::regclass) THEN
          ALTER TABLE career_vacancy_application ADD CONSTRAINT "FK_career_vacancy_application_scope"
            FOREIGN KEY ("vacancyId","organizationId","companyId") REFERENCES career_vacancy(id,"organizationId","companyId");
          ALTER TABLE career_vacancy_application ADD CONSTRAINT "FK_career_vacancy_application_student"
            FOREIGN KEY ("studentId") REFERENCES users(id);
        END IF;
      END $constraints$;
    `);
    const actor = "NULLIF(current_setting('app.actor_id',true),'')";
    const application = 'career_vacancy_application';
    const vacancy = 'career_vacancy';
    const company = (table: string) => `EXISTS (SELECT 1 FROM career_membership member
      WHERE member."companyId"=${table}."companyId" AND member."userId"::text=${actor}
      AND member."revokedAt" IS NULL AND member.role IN ('company_owner','company_member'))`;
    const owner = `"studentId"::text = ${actor}`;
    const erasure = `public.napare_erasure_row('${application}',id::text)`;
    const applicant = `(${owner} AND public.napare_tenant_allows('${application}',"organizationId"::text,false))`;
    const personalRead = `(${owner} AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access',true),''),'[]')::jsonb) cap
      WHERE cap->'personalData'->>'userId'=${actor}))`;
    const vacancyRead = `public.napare_tenant_allows('${vacancy}',"organizationId"::text,false) OR ${company(vacancy)}`;
    const vacancyWrite = `(public.napare_tenant_allows('${vacancy}',"organizationId"::text,true) AND public.napare_relation_allows('${vacancy}','id',id::text,true)) OR ${company(vacancy)}`;
    const applyWrite = `${company(application)} OR ${applicant}`;

    for (const [table, read, insert, update, remove] of [
      [vacancy, vacancyRead, company(vacancy), vacancyWrite, 'false'],
      [application, `${applyWrite} OR ${personalRead} OR ${erasure}`, applicant, applyWrite, erasure],
    ]) {
      await runner.query(`
        ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS napare_tenant_base ON "${table}";
        DROP POLICY IF EXISTS napare_tenant_select ON "${table}";
        DROP POLICY IF EXISTS napare_tenant_insert ON "${table}";
        DROP POLICY IF EXISTS napare_tenant_update ON "${table}";
        DROP POLICY IF EXISTS napare_tenant_delete ON "${table}";
        CREATE POLICY napare_tenant_base ON "${table}" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
        CREATE POLICY napare_tenant_select ON "${table}" AS RESTRICTIVE FOR SELECT USING (${read});
        CREATE POLICY napare_tenant_insert ON "${table}" AS RESTRICTIVE FOR INSERT WITH CHECK (${insert});
        CREATE POLICY napare_tenant_update ON "${table}" AS RESTRICTIVE FOR UPDATE USING (${update}) WITH CHECK (${update});
        CREATE POLICY napare_tenant_delete ON "${table}" AS RESTRICTIVE FOR DELETE USING (${remove});
        DROP TRIGGER IF EXISTS napare_active_writer ON "${table}";
        CREATE TRIGGER napare_active_writer BEFORE INSERT OR UPDATE OR DELETE ON "${table}"
          FOR EACH ROW EXECUTE FUNCTION public.napare_check_active_writer();
      `);
    }
  }

  async down(): Promise<void> {
    throw new Error('Vacancy and application data must be archived before rolling back this migration');
  }
}
