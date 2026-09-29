import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferenceTimeZone1700000000010 implements MigrationInterface {
  name = 'NotificationPreferenceTimeZone1700000000010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "timeZone" character varying(64) NOT NULL DEFAULT 'UTC'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "timeZone"`);
  }
}
