import { MigrationInterface, QueryRunner } from 'typeorm';

/** Audit entity identifiers include both row UUIDs and collection-level keys. */
export class AuditEntityIdText1700000000056 implements MigrationInterface {
  name = 'AuditEntityIdText1700000000056';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "entityId" TYPE text
      USING "entityId"::text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ hasNonUuidValues }] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM "audit_logs"
        WHERE "entityId" IS NOT NULL
          AND "entityId" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) AS "hasNonUuidValues"
    `);

    if (hasNonUuidValues) {
      throw new Error('Cannot restore audit_logs.entityId to UUID while non-UUID audit identifiers exist');
    }

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ALTER COLUMN "entityId" TYPE uuid
      USING "entityId"::uuid
    `);
  }
}
