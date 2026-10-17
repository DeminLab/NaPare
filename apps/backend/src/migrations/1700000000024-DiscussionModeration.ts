import { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscussionModeration1700000000024 implements MigrationInterface {
  name = 'DiscussionModeration1700000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "discussion_messages"
        ADD COLUMN "moderationState" character varying NOT NULL DEFAULT 'visible',
        ADD COLUMN "moderationReason" text,
        ADD COLUMN "moderatedBy" uuid,
        ADD COLUMN "moderatedAt" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_discussion_messages_moderation_state"
      ON "discussion_messages" ("moderationState", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_discussion_messages_moderation_state"`);
    await queryRunner.query(`
      ALTER TABLE "discussion_messages"
        DROP COLUMN "moderatedAt",
        DROP COLUMN "moderatedBy",
        DROP COLUMN "moderationReason",
        DROP COLUMN "moderationState"
    `);
  }
}
