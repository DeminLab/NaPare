import { MigrationInterface, QueryRunner } from 'typeorm';

export class TelegramNotifications1700000000016 implements MigrationInterface {
  name = 'TelegramNotifications1700000000016';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "telegramEnabled" boolean NOT NULL DEFAULT false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "telegramEnabled"`);
  }
}
