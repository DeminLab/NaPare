import { MigrationInterface, QueryRunner } from "typeorm";

export class SibitScheduleSync1700000000009 implements MigrationInterface {
  name = "SibitScheduleSync1700000000009";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups"
      ADD COLUMN IF NOT EXISTS "externalId" varchar
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_groups_university_external_id"
      ON "groups" ("universityId", "externalId")
      WHERE "externalId" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_groups_university_external_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "groups" DROP COLUMN IF EXISTS "externalId"`,
    );
  }
}
