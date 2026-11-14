import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TZ 9.2 expand step: onboarding by invite and the fallback linkage queue.
 *
 *  - `invite` stores only the sha256 hash of the shareable token and the
 *    bcrypt of the approved second factor (FR-ONB-02/03, SEC-09), with the
 *    14-day expiry and the per-invite attempt counter;
 *  - `link_request` is the staff queue behind FR-ONB-04/FR-STF-04;
 *  - both tables get FORCE row security with the migration-29 policy shape:
 *    the startup `assertTenantDatabase` invariant rejects any organizationId
 *    table without exactly these four restrictive policies. The select/update
 *    policies of `invite` additionally accept a relation capability on
 *    `tokenHash`, so the public claim path can reach exactly the invited row
 *    without knowing its organization (SEC-09); re-running this migration
 *    restores that predicate after a historic migration-29 replay.
 *
 * Idempotent: CREATE ... IF NOT EXISTS and DROP POLICY IF EXISTS, so dev/test
 * may execute it after synchronize (which already created the tables from the
 * entity metadata). Reversible: down() drops the two new tables; they hold
 * onboarding state authored after the expand step, so there is no legacy shape
 * to restore.
 */
export class Invites1700000000049 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invite" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL REFERENCES universities(id),
        "groupId" uuid REFERENCES groups(id) ON DELETE SET NULL,
        "studentId" uuid REFERENCES users(id) ON DELETE SET NULL,
        "studentEmail" varchar,
        "expectedFullName" varchar NOT NULL,
        "factorType" varchar NOT NULL,
        "factorHash" varchar NOT NULL,
        "tokenHash" varchar NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "claimedAt" timestamptz,
        "claimedUserId" uuid REFERENCES users(id) ON DELETE SET NULL,
        "attempts" integer NOT NULL DEFAULT 0 CONSTRAINT "CHK_invite_attempts" CHECK ("attempts" >= 0),
        "maxAttempts" integer NOT NULL DEFAULT 5 CONSTRAINT "CHK_invite_max_attempts" CHECK ("maxAttempts" >= 1),
        "createdBy" uuid REFERENCES users(id) ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_invite_token_hash" UNIQUE ("tokenHash")
      );
      CREATE INDEX IF NOT EXISTS "IDX_invite_organization_created"
        ON "invite" ("organizationId", "createdAt");
      CREATE INDEX IF NOT EXISTS "IDX_invite_student"
        ON "invite" ("studentId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "link_request" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL REFERENCES universities(id),
        "studentEmail" varchar NOT NULL,
        "studentFullName" varchar NOT NULL,
        "note" text,
        "status" varchar NOT NULL DEFAULT 'pending' CONSTRAINT "CHK_link_request_status" CHECK ("status" IN ('pending', 'approved', 'rejected')),
        "decidedBy" uuid REFERENCES users(id) ON DELETE SET NULL,
        "decidedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "IDX_link_request_organization_status_created"
        ON "link_request" ("organizationId", "status", "createdAt");
      CREATE INDEX IF NOT EXISTS "IDX_link_request_organization_email"
        ON "link_request" ("organizationId", "studentEmail");
    `);

    // The public claim flow proves the token hash (SEC-09), so read/update
    // visibility accepts a matching relation capability in addition to the
    // ordinary tenant scope; inserts/deletes stay staff-only tenant writes.
    await queryRunner.query(`
      ALTER TABLE "invite" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "invite" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS napare_tenant_base ON "invite";
      DROP POLICY IF EXISTS napare_tenant_select ON "invite";
      DROP POLICY IF EXISTS napare_tenant_insert ON "invite";
      DROP POLICY IF EXISTS napare_tenant_update ON "invite";
      DROP POLICY IF EXISTS napare_tenant_delete ON "invite";
      CREATE POLICY napare_tenant_base ON "invite" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY napare_tenant_select ON "invite" AS RESTRICTIVE FOR SELECT
        USING (public.napare_tenant_allows('invite', "organizationId"::text, false)
          OR public.napare_relation_allows('invite', 'tokenHash', "tokenHash"::text, false));
      CREATE POLICY napare_tenant_insert ON "invite" AS RESTRICTIVE FOR INSERT
        WITH CHECK (public.napare_tenant_allows('invite', "organizationId"::text, true));
      CREATE POLICY napare_tenant_update ON "invite" AS RESTRICTIVE FOR UPDATE
        USING (public.napare_tenant_allows('invite', "organizationId"::text, false)
          OR public.napare_relation_allows('invite', 'tokenHash', "tokenHash"::text, false))
        WITH CHECK (public.napare_tenant_allows('invite', "organizationId"::text, true)
          OR public.napare_relation_allows('invite', 'tokenHash', "tokenHash"::text, true));
      CREATE POLICY napare_tenant_delete ON "invite" AS RESTRICTIVE FOR DELETE
        USING (public.napare_tenant_allows('invite', "organizationId"::text, true));
    `);

    await queryRunner.query(`
      ALTER TABLE "link_request" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "link_request" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS napare_tenant_base ON "link_request";
      DROP POLICY IF EXISTS napare_tenant_select ON "link_request";
      DROP POLICY IF EXISTS napare_tenant_insert ON "link_request";
      DROP POLICY IF EXISTS napare_tenant_update ON "link_request";
      DROP POLICY IF EXISTS napare_tenant_delete ON "link_request";
      CREATE POLICY napare_tenant_base ON "link_request" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY napare_tenant_select ON "link_request" AS RESTRICTIVE FOR SELECT
        USING (public.napare_tenant_allows('link_request', "organizationId"::text, false));
      CREATE POLICY napare_tenant_insert ON "link_request" AS RESTRICTIVE FOR INSERT
        WITH CHECK (public.napare_tenant_allows('link_request', "organizationId"::text, true));
      CREATE POLICY napare_tenant_update ON "link_request" AS RESTRICTIVE FOR UPDATE
        USING (public.napare_tenant_allows('link_request', "organizationId"::text, false))
        WITH CHECK (public.napare_tenant_allows('link_request', "organizationId"::text, true));
      CREATE POLICY napare_tenant_delete ON "link_request" AS RESTRICTIVE FOR DELETE
        USING (public.napare_tenant_allows('link_request', "organizationId"::text, true));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "link_request";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invite";`);
  }
}
