import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventDrivenNotifications1700000000003 implements MigrationInterface {
  name = 'EventDrivenNotifications1700000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_records" (
        "id" uuid NOT NULL,
        "type" varchar NOT NULL,
        "actor" jsonb NOT NULL,
        "timestamp" TIMESTAMP NOT NULL,
        "universityId" uuid NOT NULL,
        "target" jsonb NOT NULL,
        "payload" jsonb NOT NULL,
        "priority" varchar NOT NULL DEFAULT 'normal',
        "recipients" jsonb,
        CONSTRAINT "PK_event_records_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_event_records_university_timestamp" ON "event_records" ("universityId", "timestamp")`);
    await queryRunner.query(`CREATE INDEX "IDX_event_records_type_timestamp" ON "event_records" ("type", "timestamp")`);

    await queryRunner.query(`ALTER TABLE "notifications" ADD "category" varchar NOT NULL DEFAULT 'all'`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD "priority" varchar NOT NULL DEFAULT 'normal'`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD "actions" jsonb`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD "eventId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_event_id" ON "notifications" ("eventId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_notifications_event_user" ON "notifications" ("eventId", "userId")`);

    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "universityId" uuid NOT NULL,
        "scheduleChanges" boolean NOT NULL DEFAULT true,
        "cancellations" boolean NOT NULL DEFAULT true,
        "roomChanges" boolean NOT NULL DEFAULT true,
        "homeworkCreated" boolean NOT NULL DEFAULT true,
        "deadlines" boolean NOT NULL DEFAULT true,
        "messages" boolean NOT NULL DEFAULT true,
        "announcements" boolean NOT NULL DEFAULT true,
        "systemAlerts" boolean NOT NULL DEFAULT true,
        "quietHoursEnabled" boolean NOT NULL DEFAULT false,
        "quietHoursStart" TIME,
        "quietHoursEnd" TIME,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_notification_preferences_user_university" ON "notification_preferences" ("userId", "universityId")`);

    await queryRunner.query(`
      CREATE TABLE "inbox_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "eventId" uuid,
        "userId" uuid NOT NULL,
        "universityId" uuid NOT NULL,
        "type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "description" text NOT NULL,
        "deepLink" varchar,
        "priority" varchar NOT NULL DEFAULT 'normal',
        "status" varchar NOT NULL DEFAULT 'open',
        "dueAt" TIMESTAMP,
        "actions" jsonb,
        "data" jsonb,
        "completedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inbox_items_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_inbox_items_user_university_status" ON "inbox_items" ("userId", "universityId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_inbox_items_event_user" ON "inbox_items" ("eventId", "userId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_inbox_items_event_user_type" ON "inbox_items" ("eventId", "userId", "type")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_inbox_items_event_user_type"`);
    await queryRunner.query(`DROP INDEX "IDX_inbox_items_event_user"`);
    await queryRunner.query(`DROP INDEX "IDX_inbox_items_user_university_status"`);
    await queryRunner.query(`DROP TABLE "inbox_items"`);
    await queryRunner.query(`DROP INDEX "UQ_notification_preferences_user_university"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP INDEX "UQ_notifications_event_user"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_event_id"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "eventId"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "actions"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "priority"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "category"`);
    await queryRunner.query(`DROP INDEX "IDX_event_records_type_timestamp"`);
    await queryRunner.query(`DROP INDEX "IDX_event_records_university_timestamp"`);
    await queryRunner.query(`DROP TABLE "event_records"`);
  }
}
