import { MigrationInterface, QueryRunner } from 'typeorm';

export class CareerModeration1700000000040 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE career_task
      ADD COLUMN IF NOT EXISTS "moderationStatus" varchar NOT NULL DEFAULT 'not_submitted',
      ADD COLUMN IF NOT EXISTS "moderationFlags" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "moderationPolicyVersion" varchar NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "moderationReason" text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "moderationDecidedBy" uuid NULL,
      ADD COLUMN IF NOT EXISTS "moderationDecidedAt" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "moderationContentVersion" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "moderationReviewedVersion" integer NULL;
      CREATE TABLE IF NOT EXISTS career_task_complaint (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL, "taskId" uuid NOT NULL, "studentId" uuid NOT NULL,
        category varchar NOT NULL, details text NOT NULL, "taskSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb, state varchar NOT NULL DEFAULT 'open', resolution text NOT NULL DEFAULT '',
        "resolvedBy" uuid NULL, "resolvedAt" timestamp NULL, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now());
      ALTER TABLE career_task_complaint ADD COLUMN IF NOT EXISTS "taskSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb;
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_career_task_complaint_open" ON career_task_complaint ("taskId","studentId") WHERE state='open';
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_career_task_id_university" ON career_task (id,"universityId");
      DO $constraints$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_career_complaint_task_university' AND conrelid='career_task_complaint'::regclass) THEN
          ALTER TABLE career_task_complaint ADD CONSTRAINT "FK_career_complaint_task_university" FOREIGN KEY ("taskId","universityId") REFERENCES career_task(id,"universityId") ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FK_career_complaint_student' AND conrelid='career_task_complaint'::regclass) THEN
          ALTER TABLE career_task_complaint ADD CONSTRAINT "FK_career_complaint_student" FOREIGN KEY ("studentId") REFERENCES users(id) ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CHK_career_complaint_state' AND conrelid='career_task_complaint'::regclass) THEN
          ALTER TABLE career_task_complaint ADD CONSTRAINT "CHK_career_complaint_state" CHECK (state IN ('open','resolved','dismissed'));
          ALTER TABLE career_task_complaint ADD CONSTRAINT "CHK_career_complaint_category" CHECK (category IN ('prepayment','misleading','unsafe','other'));
        END IF;
      END $constraints$;
      ALTER TABLE career_task_complaint ENABLE ROW LEVEL SECURITY;
      ALTER TABLE career_task_complaint FORCE ROW LEVEL SECURITY`);
    const selfRead = `(("studentId"::text=NULLIF(current_setting('app.actor_id',true),'') OR "resolvedBy"::text=NULLIF(current_setting('app.actor_id',true),'')) AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access',true),''),'[]')::jsonb) cap
      WHERE cap->'personalData'->>'userId'=NULLIF(current_setting('app.actor_id',true),'')))`;
    const erased = `public.napare_erasure_row('career_task_complaint',id::text)`;
    await runner.query(`DROP POLICY IF EXISTS napare_tenant_base ON career_task_complaint;
      CREATE POLICY napare_tenant_base ON career_task_complaint AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true)`);
    for (const [name, verb] of [['select','SELECT'],['insert','INSERT'],['update','UPDATE'],['delete','DELETE']] as const) {
      const ordinary = `public.napare_tenant_allows('career_task_complaint',"universityId"::text,${name !== 'select'})`;
      const predicate = name === 'select' ? `(${ordinary} OR ${selfRead} OR ${erased})` : name === 'insert' ? ordinary : `(${ordinary} OR ${erased})`;
      const updateRead = `(public.napare_tenant_allows('career_task_complaint',"universityId"::text,false) OR ${selfRead} OR ${erased})`;
      await runner.query(`DROP POLICY IF EXISTS napare_tenant_${name} ON career_task_complaint`);
      await runner.query(`CREATE POLICY napare_tenant_${name} ON career_task_complaint AS RESTRICTIVE FOR ${verb} ${name === 'insert' ? `WITH CHECK (${predicate})` : `USING (${name === 'update' ? updateRead : predicate})${name === 'update' ? ` WITH CHECK (${predicate})` : ''}`}`);
    }
    await runner.query(`DROP TRIGGER IF EXISTS napare_active_writer ON career_task_complaint;
      CREATE TRIGGER napare_active_writer BEFORE INSERT OR UPDATE OR DELETE ON career_task_complaint FOR EACH ROW EXECUTE FUNCTION public.napare_check_active_writer()`);
  }

  async down(runner: QueryRunner): Promise<void> {
    const [state] = await runner.query(`SELECT
      (SELECT count(*) FROM career_task_complaint) +
      (SELECT count(*) FROM career_task WHERE "moderationStatus"<>'not_submitted' OR "moderationContentVersion">1) AS count`);
    if (Number(state.count)) throw new Error('Cannot remove moderation records without an explicit archival procedure');
    await runner.query(`DROP TABLE career_task_complaint; DROP INDEX "IDX_career_task_id_university";
      ALTER TABLE career_task DROP COLUMN "moderationStatus", DROP COLUMN "moderationFlags", DROP COLUMN "moderationPolicyVersion", DROP COLUMN "moderationReason",
      DROP COLUMN "moderationDecidedBy", DROP COLUMN "moderationDecidedAt", DROP COLUMN "moderationContentVersion", DROP COLUMN "moderationReviewedVersion"`);
  }
}
