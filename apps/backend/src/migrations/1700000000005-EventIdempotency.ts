import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventIdempotency1700000000005 implements MigrationInterface {
  name = 'EventIdempotency1700000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "event_records" ADD "idempotencyKey" varchar`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_event_records_university_idempotency_key" ON "event_records" ("universityId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_event_records_university_idempotency_key"`);
    await queryRunner.query(`ALTER TABLE "event_records" DROP COLUMN "idempotencyKey"`);
  }
}
