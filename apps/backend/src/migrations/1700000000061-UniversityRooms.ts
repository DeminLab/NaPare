import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tenant-owned room catalog. Rooms are archived with a reason; lessons keep their legacy free-text room field. */
export class UniversityRooms1700000000061 implements MigrationInterface {
  name = 'UniversityRooms1700000000061';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS "rooms" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL REFERENCES "universities"("id") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "code" varchar(64),
        "building" varchar(120),
        "floor" varchar(32),
        "capacity" integer,
        "archivedAt" timestamp NULL,
        "archiveReason" varchar(500),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_rooms_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" BETWEEN 1 AND 10000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rooms_university_name_active"
        ON "rooms" ("organizationId", lower("name")) WHERE "archivedAt" IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rooms_university_code"
        ON "rooms" ("organizationId", lower("code")) WHERE "code" IS NOT NULL;
      CREATE INDEX IF NOT EXISTS "IDX_rooms_university_archived"
        ON "rooms" ("organizationId", "archivedAt");
      ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "rooms" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS napare_tenant_base ON "rooms";
      DROP POLICY IF EXISTS napare_tenant_select ON "rooms";
      DROP POLICY IF EXISTS napare_tenant_insert ON "rooms";
      DROP POLICY IF EXISTS napare_tenant_update ON "rooms";
      DROP POLICY IF EXISTS napare_tenant_delete ON "rooms";
      CREATE POLICY napare_tenant_base ON "rooms" AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
      CREATE POLICY napare_tenant_select ON "rooms" AS RESTRICTIVE FOR SELECT
        USING (public.napare_tenant_allows('rooms', "organizationId"::text, false));
      CREATE POLICY napare_tenant_insert ON "rooms" AS RESTRICTIVE FOR INSERT
        WITH CHECK (public.napare_tenant_allows('rooms', "organizationId"::text, true));
      CREATE POLICY napare_tenant_update ON "rooms" AS RESTRICTIVE FOR UPDATE
        USING (public.napare_tenant_allows('rooms', "organizationId"::text, false))
        WITH CHECK (public.napare_tenant_allows('rooms', "organizationId"::text, true));
      CREATE POLICY napare_tenant_delete ON "rooms" AS RESTRICTIVE FOR DELETE
        USING (public.napare_tenant_allows('rooms', "organizationId"::text, true));
      DROP TRIGGER IF EXISTS napare_active_writer ON "rooms";
      CREATE TRIGGER napare_active_writer BEFORE INSERT OR UPDATE OR DELETE ON "rooms"
        FOR EACH ROW EXECUTE FUNCTION public.napare_check_active_writer();
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    const [{ count }] = await runner.query('SELECT count(*)::int AS count FROM "rooms"');
    if (count) throw new Error('Cannot drop the room catalog while room records exist');
    await runner.query('DROP TABLE IF EXISTS "rooms"');
  }
}
