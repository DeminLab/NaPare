import { MigrationInterface, QueryRunner } from 'typeorm';

export class AcademicEventModeration1700000000026 implements MigrationInterface {
  name = 'AcademicEventModeration1700000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "academic_events" ADD "hiddenAt" TIMESTAMP');
    await queryRunner.query('ALTER TABLE "academic_events" ADD "hiddenBy" uuid');
    await queryRunner.query('ALTER TABLE "academic_events" ADD "hideReason" character varying(500)');
    await queryRunner.query('CREATE INDEX "IDX_academic_events_hidden" ON "academic_events" ("universityId", "hiddenAt")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_academic_events_hidden"');
    await queryRunner.query('ALTER TABLE "academic_events" DROP COLUMN "hideReason"');
    await queryRunner.query('ALTER TABLE "academic_events" DROP COLUMN "hiddenBy"');
    await queryRunner.query('ALTER TABLE "academic_events" DROP COLUMN "hiddenAt"');
  }
}
