import { MigrationInterface, QueryRunner } from 'typeorm';

export class TelegramAccountLink1700000000015 implements MigrationInterface {
  name = 'TelegramAccountLink1700000000015';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "telegramUserId" character varying`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_telegram_user_id" ON "users" ("telegramUserId")`);
    await queryRunner.query(`CREATE TABLE "telegram_link_challenges" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "tokenHash" character varying(64) NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "consumedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "PK_telegram_link_challenges" PRIMARY KEY ("id"),
      CONSTRAINT "FK_telegram_link_challenges_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_telegram_link_challenges_token_hash" ON "telegram_link_challenges" ("tokenHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_telegram_link_challenges_user_created" ON "telegram_link_challenges" ("userId", "createdAt")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_telegram_link_challenges_user_created"`);
    await queryRunner.query(`DROP INDEX "IDX_telegram_link_challenges_token_hash"`);
    await queryRunner.query(`DROP TABLE "telegram_link_challenges"`);
    await queryRunner.query(`DROP INDEX "IDX_users_telegram_user_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "telegramUserId"`);
  }
}
