import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantRowSecurity1700000000029 } from './1700000000029-TenantRowSecurity';

/** Frozen selectors. Export must not grant university-wide access or UPDATE/DELETE. */
export class PersonalDataRead1700000000037 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE OR REPLACE FUNCTION public.napare_personal_export_enabled()
      RETURNS boolean LANGUAGE sql STABLE AS $fn$
      SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(NULLIF(current_setting('app.tenant_access', true), ''), '[]')::jsonb) cap
        WHERE cap->'personalData'->>'userId' = NULLIF(current_setting('app.actor_id', true), ''))
      $fn$`);
    const direct: Record<string, string[]> = {
      absences: ['studentId'], attendance_records: ['studentId', 'markedById'], attendance_qr_sessions: ['createdById'],
      academic_events: ['actorId', 'hiddenBy'], academic_schedule_changes: ['actorId'],
      career_membership: ['userId', 'revokedBy'], career_profile: ['studentId'], career_admission: ['studentId'], career_availability: ['studentId'],
      curator_assignments: ['userId', 'grantedBy', 'revokedBy'], user_favorites: ['userId'], inbox_items: ['userId'],
      notifications: ['userId'], notification_preferences: ['userId'], notification_deliveries: ['userId'], personal_lesson_notes: ['userId'],
      office_assignments: ['userId', 'assignedBy', 'revokedBy'], office_routes: ['configuredBy'], student_requests: ['studentId', 'createdBy', 'assignedTo'],
      request_steps: ['assigneeId', 'decidedBy'], request_decisions: ['actorId'], request_documents: ['addedBy'], schedule_import_jobs: ['actorId'],
      academic_identities: ['userId', 'linkedBy'], faculties: ['deanUserId'], groups: ['curatorId'], teachers: ['userId'],
    };
    const predicates: Record<string, string> = Object.fromEntries(Object.entries(direct).map(([table, fields]) => [table,
      fields.map(field => `"${field}"::text = NULLIF(current_setting('app.actor_id', true), '')`).join(' OR ')]));
    for (const table of ['request_steps', 'request_decisions', 'request_documents']) {
      predicates[table] += ` OR EXISTS (SELECT 1 FROM student_requests p WHERE p.id = "${table}"."requestId" AND p."studentId"::text = NULLIF(current_setting('app.actor_id', true), ''))`;
    }
    predicates.event_records = `actor->>'id' = NULLIF(current_setting('app.actor_id', true), '') OR recipients @> jsonb_build_array(NULLIF(current_setting('app.actor_id', true), ''))`;
    predicates.office_routes += ` OR NULLIF(current_setting('app.actor_id', true), '')::uuid = ANY("assigneeIds")`;
    for (const table of ['lessons', 'lesson_series', 'lesson_occurrences']) {
      predicates[table] = `"teacherId"::text = NULLIF(current_setting('app.actor_id', true), '') OR EXISTS (SELECT 1 FROM teachers p WHERE p.id::text = "${table}"."teacherId"::text AND p."userId"::text = NULLIF(current_setting('app.actor_id', true), '') AND p."universityId" = "${table}"."universityId")`;
    }
    predicates.lessons += ` OR EXISTS (SELECT 1 FROM users p WHERE p.id::text = NULLIF(current_setting('app.actor_id', true), '') AND p."sourceTeacherId" IS NOT NULL AND p."sourceTeacherId" = lessons."sourceTeacherId" AND p."universityId" = lessons."universityId")`;
    for (const [table, predicate] of Object.entries(predicates)) {
      const policies = await runner.query(`SELECT pg_get_expr(p.polqual, p.polrelid) AS expression FROM pg_policy p
        JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=current_schema() AND c.relname=$1 AND p.polname='napare_tenant_select'`, [table]);
      if (policies.length !== 1) throw new Error(`Missing tenant export policy: ${table}`);
      await runner.query(`ALTER POLICY napare_tenant_select ON "${table}" USING ((${policies[0].expression}) OR (public.napare_personal_export_enabled() AND (${predicate})))`);
    }
  }
  async down(runner: QueryRunner): Promise<void> {
    await new TenantRowSecurity1700000000029().up(runner);
    await runner.query('DROP FUNCTION public.napare_personal_export_enabled()');
  }
}
