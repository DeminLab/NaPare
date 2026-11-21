import { MigrationInterface, QueryRunner } from 'typeorm';

/** Public schedule visibility is a per-university, explicit cabinet opt-in. */
export class PublicUniversitySchedule1700000000054 implements MigrationInterface {
  name = 'PublicUniversitySchedule1700000000054';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "universities"
      ADD COLUMN IF NOT EXISTS "publicScheduleEnabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "universities"
      DROP COLUMN IF EXISTS "publicScheduleEnabled"
    `);
  }
}
