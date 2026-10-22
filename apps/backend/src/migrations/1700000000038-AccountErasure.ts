import { MigrationInterface, QueryRunner } from 'typeorm';
import { PersonalDataRead1700000000037 } from './1700000000037-PersonalDataRead';
import { TenantRowSecurity1700000000029 } from './1700000000029-TenantRowSecurity';

export class AccountErasure1700000000038 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS "personalDataDeletedAt" timestamp NULL');
    await runner.query(`CREATE OR REPLACE FUNCTION public.napare_erasure_row(table_name text, row_id text)
      RETURNS boolean LANGUAGE sql STABLE AS $fn$
      SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access', true), ''), '[]')::jsonb) cap
        WHERE cap->'personalErasure'->>'userId' = NULLIF(current_setting('app.actor_id', true), '')
          AND cap->'personalErasure'->'rows'->table_name ? row_id)
      $fn$`);
    // The application proves every ID through subject-only selectors before establishing this capability.
    const tables = ['users', 'academic_identities', 'personal_lesson_notes', 'user_favorites', 'notifications',
      'notification_deliveries', 'notification_preferences', 'inbox_items', 'career_profile', 'career_availability',
      'career_membership', 'career_admission', 'curator_assignments', 'office_assignments', 'groups', 'faculties', 'attendance_qr_sessions'];
    for (const table of tables) {
      const key = table === 'career_availability' ? 'studentId' : 'id';
      const policies = await runner.query(`SELECT p.polname AS name, pg_get_expr(p.polqual,p.polrelid) AS using, pg_get_expr(p.polwithcheck,p.polrelid) AS checking
        FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=current_schema() AND c.relname=$1 AND p.polname IN ('napare_tenant_select','napare_tenant_update','napare_tenant_delete')`, [table]);
      if (policies.length !== 3) throw new Error(`Missing erasure tenant policies: ${table}`);
      for (const policy of policies) {
        const predicate = `public.napare_erasure_row('${table}', "${key}"::text)`;
        await runner.query(`ALTER POLICY "${policy.name}" ON "${table}" USING ((${policy.using}) OR ${predicate})${policy.checking ? ` WITH CHECK ((${policy.checking}) OR ${predicate})` : ''}`);
      }
    }
    await runner.query(`CREATE OR REPLACE FUNCTION public.napare_check_active_writer()
      RETURNS trigger LANGUAGE plpgsql AS $fn$
      DECLARE actor_id text; actor_erased timestamp; subject_id text; subject_erased timestamp;
      BEGIN
        actor_id := NULLIF(current_setting('app.actor_id', true), '');
        IF actor_id IS NOT NULL THEN
          -- SHARE conflicts with the erasure row lock. Stale in-flight writes resume only after checking the tombstone.
          SELECT "personalDataDeletedAt" INTO actor_erased FROM users WHERE id::text=actor_id FOR SHARE;
          IF NOT FOUND OR actor_erased IS NOT NULL THEN RAISE EXCEPTION 'Account data has been deleted' USING ERRCODE='42501'; END IF;
        END IF;
        IF TG_TABLE_NAME = 'users' AND TG_OP <> 'INSERT' THEN
          IF to_jsonb(OLD)->>'personalDataDeletedAt' IS NOT NULL THEN
            RAISE EXCEPTION 'An erased account tombstone is immutable' USING ERRCODE='42501';
          END IF;
        END IF;
        IF TG_OP <> 'DELETE' AND TG_TABLE_NAME IN ('user_favorites','device_tokens','notifications','notification_deliveries',
          'notification_preferences','inbox_items','personal_lesson_notes','academic_identities','career_profile','career_availability',
          'career_notice','career_ai_request','career_portfolio','telegram_link_challenges') THEN
          subject_id := COALESCE(to_jsonb(NEW)->>'userId', to_jsonb(NEW)->>'studentId');
          SELECT "personalDataDeletedAt" INTO subject_erased FROM users WHERE id::text=subject_id FOR SHARE;
          IF NOT FOUND OR subject_erased IS NOT NULL THEN RAISE EXCEPTION 'Private data recipient is unavailable' USING ERRCODE='42501'; END IF;
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $fn$;
      DO $block$ DECLARE target record;
      BEGIN
        FOR target IN SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename <> 'migrations' LOOP
          EXECUTE format('DROP TRIGGER IF EXISTS napare_active_writer ON %I', target.tablename);
          EXECUTE format('CREATE TRIGGER napare_active_writer BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.napare_check_active_writer()', target.tablename);
        END LOOP;
      END $block$`);
  }
  async down(runner: QueryRunner): Promise<void> {
    const [state] = await runner.query('SELECT count(*)::int AS count FROM users WHERE "personalDataDeletedAt" IS NOT NULL');
    if (state.count) throw new Error('Cannot remove the tombstone guard while erased accounts exist');
    await runner.query(`DO $block$ DECLARE target record; BEGIN
      FOR target IN SELECT tablename FROM pg_tables WHERE schemaname=current_schema() LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS napare_active_writer ON %I', target.tablename);
      END LOOP;
      END $block$; DROP FUNCTION public.napare_check_active_writer()`);
    await new TenantRowSecurity1700000000029().up(runner);
    await new PersonalDataRead1700000000037().up(runner);
    await runner.query('DROP FUNCTION public.napare_erasure_row(text,text); ALTER TABLE users DROP COLUMN "personalDataDeletedAt"');
  }
}
