import { MigrationInterface, QueryRunner } from 'typeorm';

export class AcademicContext1700000000004 implements MigrationInterface {
  name = 'AcademicContext1700000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "academic_courses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "facultyId" uuid,
        "code" varchar(100) NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "credits" numeric,
        "isActive" boolean NOT NULL DEFAULT true,
        "source" varchar,
        "lastSyncedAt" timestamp,
        "sourceVersion" varchar,
        "syncStatus" varchar NOT NULL DEFAULT 'unknown',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_academic_courses_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_academic_courses_university_code" UNIQUE ("universityId", "code")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_academic_courses_university_name" ON "academic_courses" ("universityId", "name")`);

    await queryRunner.query(`
      CREATE TABLE "lesson_series" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "courseId" uuid NOT NULL,
        "groupId" uuid NOT NULL,
        "teacherId" uuid,
        "title" varchar,
        "subjectType" varchar,
        "recurrenceRule" varchar NOT NULL DEFAULT 'weekly',
        "dayOfWeek" integer NOT NULL,
        "startTime" varchar(5) NOT NULL,
        "endTime" varchar(5) NOT NULL,
        "pairNumber" integer NOT NULL,
        "weekType" varchar NOT NULL DEFAULT 'both',
        "room" varchar,
        "building" varchar,
        "validFrom" timestamp NOT NULL,
        "validTo" timestamp,
        "source" varchar,
        "lastSyncedAt" timestamp,
        "sourceVersion" varchar,
        "syncStatus" varchar NOT NULL DEFAULT 'unknown',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_series_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_lesson_series_university_course" ON "lesson_series" ("universityId", "courseId")`);
    await queryRunner.query(`CREATE INDEX "IDX_lesson_series_university_group" ON "lesson_series" ("universityId", "groupId")`);
    await queryRunner.query(`CREATE INDEX "IDX_lesson_series_university_teacher" ON "lesson_series" ("universityId", "teacherId")`);

    await queryRunner.query(`
      CREATE TABLE "lesson_occurrences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "seriesId" uuid NOT NULL,
        "courseId" uuid NOT NULL,
        "groupId" uuid NOT NULL,
        "teacherId" uuid,
        "startsAt" timestamp NOT NULL,
        "endsAt" timestamp NOT NULL,
        "room" varchar,
        "building" varchar,
        "status" varchar NOT NULL DEFAULT 'scheduled',
        "changeReason" text,
        "legacyLessonId" uuid,
        "source" varchar,
        "lastSyncedAt" timestamp,
        "sourceVersion" varchar,
        "syncStatus" varchar NOT NULL DEFAULT 'unknown',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_occurrences_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_occurrences_series_starts_at" UNIQUE ("seriesId", "startsAt")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_lesson_occurrences_university_starts_at" ON "lesson_occurrences" ("universityId", "startsAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_lesson_occurrences_university_group_starts_at" ON "lesson_occurrences" ("universityId", "groupId", "startsAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_lesson_occurrences_university_course_starts_at" ON "lesson_occurrences" ("universityId", "courseId", "startsAt")`);

    await queryRunner.query(`
      CREATE TABLE "course_spaces" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "courseId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_spaces_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_spaces_course_id" UNIQUE ("courseId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "lesson_spaces" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "courseSpaceId" uuid NOT NULL,
        "occurrenceId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_spaces_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_spaces_occurrence_id" UNIQUE ("occurrenceId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_lesson_spaces_university_course_space" ON "lesson_spaces" ("universityId", "courseSpaceId")`);

    await queryRunner.query(`
      CREATE TABLE "academic_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "type" varchar NOT NULL,
        "courseId" uuid,
        "groupId" uuid,
        "occurrenceId" uuid,
        "actorId" uuid,
        "title" varchar NOT NULL,
        "description" text,
        "startsAt" timestamp,
        "endsAt" timestamp,
        "priority" varchar NOT NULL DEFAULT 'normal',
        "payload" jsonb,
        "source" varchar,
        "lastSyncedAt" timestamp,
        "sourceVersion" varchar,
        "syncStatus" varchar NOT NULL DEFAULT 'unknown',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_academic_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_academic_events_university_starts_at" ON "academic_events" ("universityId", "startsAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_academic_events_university_type" ON "academic_events" ("universityId", "type")`);
    await queryRunner.query(`CREATE INDEX "IDX_academic_events_context" ON "academic_events" ("universityId", "courseId", "groupId")`);

    await queryRunner.query(`
      CREATE TABLE "academic_schedule_changes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "occurrenceId" uuid,
        "legacyLessonId" uuid,
        "originalValue" jsonb NOT NULL,
        "newValue" jsonb NOT NULL,
        "reason" text,
        "actorId" uuid,
        "source" varchar,
        "timestamp" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_academic_schedule_changes_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_academic_schedule_changes_occurrence_timestamp" ON "academic_schedule_changes" ("occurrenceId", "timestamp")`);
    await queryRunner.query(`CREATE INDEX "IDX_academic_schedule_changes_university_timestamp" ON "academic_schedule_changes" ("universityId", "timestamp")`);

    await queryRunner.query(`ALTER TABLE "lessons" ADD "courseId" uuid`);
    await queryRunner.query(`ALTER TABLE "lessons" ADD "seriesId" uuid`);
    await queryRunner.query(`ALTER TABLE "lessons" ADD "occurrenceId" uuid`);
    await queryRunner.query(`ALTER TABLE "lessons" ADD "lastSyncedAt" timestamp`);
    await queryRunner.query(`ALTER TABLE "lessons" ADD "sourceVersion" varchar`);
    await queryRunner.query(`ALTER TABLE "lessons" ADD "syncStatus" varchar NOT NULL DEFAULT 'unknown'`);
    await queryRunner.query(`ALTER TABLE "lesson_changes" ADD "reason" text`);
    await queryRunner.query(`ALTER TABLE "lesson_changes" ADD "source" varchar`);

    await queryRunner.query(`ALTER TABLE "pair_spaces" ADD "courseId" uuid`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" ADD "lessonOccurrenceId" uuid`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" ADD "lessonSpaceId" uuid`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" ADD "source" varchar`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" ADD "lastSyncedAt" timestamp`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" ADD "sourceVersion" varchar`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" ADD "syncStatus" varchar NOT NULL DEFAULT 'unknown'`);

    for (const table of ['homeworks', 'announcements', 'absences']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "source" varchar`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD "lastSyncedAt" timestamp`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD "sourceVersion" varchar`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD "syncStatus" varchar NOT NULL DEFAULT 'unknown'`);
    }

    await queryRunner.query(`
      INSERT INTO "academic_courses" ("universityId", "code", "name", "isActive", "source", "syncStatus")
      SELECT DISTINCT l."universityId", 'legacy-' || md5(l."universityId"::text || ':' || l."subject"), l."subject", true, 'legacy', 'synced'
      FROM "lessons" l
      WHERE l."subject" IS NOT NULL
      ON CONFLICT ("universityId", "code") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "lesson_series" ("universityId", "courseId", "groupId", "teacherId", "title", "subjectType", "dayOfWeek", "startTime", "endTime", "pairNumber", "weekType", "room", "building", "validFrom", "validTo", "source", "syncStatus")
      SELECT l."universityId", c."id", l."groupId", l."teacherId", l."subject", l."subjectType", l."dayOfWeek", l."startTime", l."endTime", l."pairNumber", l."weekType", l."room", l."building", MIN(l."startDate"), MAX(l."endDate"), COALESCE(l."source", 'legacy'), 'synced'
      FROM "lessons" l
      JOIN "academic_courses" c ON c."universityId" = l."universityId" AND c."name" = l."subject"
      GROUP BY l."universityId", c."id", l."groupId", l."teacherId", l."subject", l."subjectType", l."dayOfWeek", l."startTime", l."endTime", l."pairNumber", l."weekType", l."room", l."building", l."source"
    `);
    await queryRunner.query(`
      INSERT INTO "lesson_occurrences" ("universityId", "seriesId", "courseId", "groupId", "teacherId", "startsAt", "endsAt", "room", "building", "status", "changeReason", "legacyLessonId", "source", "lastSyncedAt", "syncStatus")
      SELECT l."universityId", s."id", s."courseId", l."groupId", l."teacherId", l."startDate", l."endDate", l."room", l."building", CASE WHEN l."isChanged" THEN 'rescheduled' ELSE 'scheduled' END, l."changeDescription", l."id", COALESCE(l."source", 'legacy'), now(), 'synced'
      FROM "lessons" l
      JOIN "academic_courses" c ON c."universityId" = l."universityId" AND c."name" = l."subject"
      JOIN "lesson_series" s ON s."courseId" = c."id" AND s."groupId" = l."groupId" AND COALESCE(s."teacherId", '00000000-0000-0000-0000-000000000000') = COALESCE(l."teacherId", '00000000-0000-0000-0000-000000000000') AND s."dayOfWeek" = l."dayOfWeek" AND s."startTime" = l."startTime" AND s."endTime" = l."endTime" AND s."pairNumber" = l."pairNumber" AND s."room" IS NOT DISTINCT FROM l."room"
      ON CONFLICT ("seriesId", "startsAt") DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "lessons" l
      SET "courseId" = c."id", "seriesId" = s."id", "occurrenceId" = o."id", "lastSyncedAt" = now(), "syncStatus" = 'synced'
      FROM "academic_courses" c, "lesson_series" s, "lesson_occurrences" o
      WHERE c."universityId" = l."universityId" AND c."name" = l."subject"
        AND s."courseId" = c."id" AND s."groupId" = l."groupId" AND s."dayOfWeek" = l."dayOfWeek" AND s."startTime" = l."startTime" AND s."endTime" = l."endTime" AND s."pairNumber" = l."pairNumber"
        AND o."legacyLessonId" = l."id"
    `);
    await queryRunner.query(`
      UPDATE "pair_spaces" ps
      SET "courseId" = l."courseId", "lessonOccurrenceId" = l."occurrenceId"
      FROM "lessons" l
      WHERE ps."lessonId" = l."id"
    `);
    await queryRunner.query(`
      INSERT INTO "course_spaces" ("universityId", "courseId", "name")
      SELECT c."universityId", c."id", c."name"
      FROM "academic_courses" c
      ON CONFLICT ("courseId") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "lesson_spaces" ("universityId", "courseSpaceId", "occurrenceId", "name")
      SELECT ps."universityId", cs."id", ps."lessonOccurrenceId", ps."name"
      FROM "pair_spaces" ps
      JOIN "course_spaces" cs ON cs."courseId" = ps."courseId"
      WHERE ps."lessonOccurrenceId" IS NOT NULL
      ON CONFLICT ("occurrenceId") DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "pair_spaces" ps
      SET "lessonSpaceId" = ls."id"
      FROM "lesson_spaces" ls
      WHERE ls."occurrenceId" = ps."lessonOccurrenceId"
    `);
    await queryRunner.query(`
      INSERT INTO "academic_events" ("universityId", "type", "courseId", "groupId", "occurrenceId", "title", "startsAt", "endsAt", "source", "syncStatus")
      SELECT o."universityId", 'lesson', o."courseId", o."groupId", o."id", c."name", o."startsAt", o."endsAt", COALESCE(o."source", 'legacy'), 'synced'
      FROM "lesson_occurrences" o JOIN "academic_courses" c ON c."id" = o."courseId"
    `);
    await queryRunner.query(`
      INSERT INTO "academic_schedule_changes" ("universityId", "occurrenceId", "legacyLessonId", "originalValue", "newValue", "actorId", "source", "timestamp")
      SELECT l."universityId", l."occurrenceId", lc."lessonId", lc."oldValues", lc."newValues", lc."changedBy", 'legacy', lc."changedAt"
      FROM "lesson_changes" lc JOIN "lessons" l ON l."id" = lc."lessonId"
    `);

    await queryRunner.query(`CREATE INDEX "IDX_lessons_course_occurrence" ON "lessons" ("courseId", "occurrenceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pair_spaces_course_occurrence" ON "pair_spaces" ("courseId", "lessonOccurrenceId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_pair_spaces_course_occurrence"`);
    await queryRunner.query(`DROP INDEX "IDX_lessons_course_occurrence"`);
    await queryRunner.query(`DROP INDEX "IDX_academic_schedule_changes_university_timestamp"`);
    await queryRunner.query(`DROP INDEX "IDX_academic_schedule_changes_occurrence_timestamp"`);
    await queryRunner.query(`DROP TABLE "academic_schedule_changes"`);
    await queryRunner.query(`DROP INDEX "IDX_academic_events_context"`);
    await queryRunner.query(`DROP INDEX "IDX_academic_events_university_type"`);
    await queryRunner.query(`DROP INDEX "IDX_academic_events_university_starts_at"`);
    await queryRunner.query(`DROP TABLE "academic_events"`);
    await queryRunner.query(`DROP TABLE "course_spaces"`);
    await queryRunner.query(`DROP INDEX "IDX_lesson_spaces_university_course_space"`);
    await queryRunner.query(`DROP TABLE "lesson_spaces"`);
    await queryRunner.query(`DROP INDEX "IDX_lesson_occurrences_university_course_starts_at"`);
    await queryRunner.query(`DROP INDEX "IDX_lesson_occurrences_university_group_starts_at"`);
    await queryRunner.query(`DROP INDEX "IDX_lesson_occurrences_university_starts_at"`);
    await queryRunner.query(`DROP TABLE "lesson_occurrences"`);
    await queryRunner.query(`DROP INDEX "IDX_lesson_series_university_teacher"`);
    await queryRunner.query(`DROP INDEX "IDX_lesson_series_university_group"`);
    await queryRunner.query(`DROP INDEX "IDX_lesson_series_university_course"`);
    await queryRunner.query(`DROP TABLE "lesson_series"`);
    await queryRunner.query(`DROP INDEX "IDX_academic_courses_university_name"`);
    await queryRunner.query(`DROP TABLE "academic_courses"`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" DROP COLUMN "courseId"`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" DROP COLUMN "lessonOccurrenceId"`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" DROP COLUMN "lessonSpaceId"`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" DROP COLUMN "lastSyncedAt"`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" DROP COLUMN "sourceVersion"`);
    await queryRunner.query(`ALTER TABLE "pair_spaces" DROP COLUMN "syncStatus"`);
    for (const table of ['homeworks', 'announcements', 'absences']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "source"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "lastSyncedAt"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "sourceVersion"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "syncStatus"`);
    }
    await queryRunner.query(`ALTER TABLE "lesson_changes" DROP COLUMN "reason"`);
    await queryRunner.query(`ALTER TABLE "lesson_changes" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "courseId"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "seriesId"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "occurrenceId"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "lastSyncedAt"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "sourceVersion"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "syncStatus"`);
  }
}
