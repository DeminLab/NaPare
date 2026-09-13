import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "universities" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "city" VARCHAR(100) NOT NULL,
        "connectorType" VARCHAR(50),
        "connectorConfig" JSONB,
        "status" VARCHAR(20) DEFAULT 'pending',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "faculties" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "universityId" UUID NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "code" VARCHAR(50) NOT NULL,
        "deanUserId" UUID,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_faculties_university" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "facultyId" UUID,
        "universityId" UUID NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "curriculumYear" VARCHAR(10),
        "specialization" VARCHAR(255),
        "curatorId" UUID,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_groups_faculty" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_groups_university" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "teachers" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "universityId" UUID NOT NULL,
        "department" VARCHAR(255),
        "position" VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_teachers_university" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) UNIQUE NOT NULL,
        "passwordHash" VARCHAR(255) NOT NULL,
        "firstName" VARCHAR(100),
        "lastName" VARCHAR(100),
        "phone" VARCHAR(20),
        "avatarUrl" VARCHAR(500),
        "roles" TEXT DEFAULT 'student',
        "universityId" UUID,
        "groupId" UUID,
        "isActive" BOOLEAN DEFAULT true,
        "lastLoginAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "lessons" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "universityId" UUID NOT NULL,
        "groupId" UUID NOT NULL,
        "teacherId" UUID,
        "subject" VARCHAR(255) NOT NULL,
        "subjectType" VARCHAR(50),
        "room" VARCHAR(50),
        "building" VARCHAR(100),
        "dayOfWeek" INTEGER NOT NULL,
        "startTime" VARCHAR(5) NOT NULL,
        "endTime" VARCHAR(5) NOT NULL,
        "pairNumber" INTEGER NOT NULL,
        "weekType" VARCHAR(10) DEFAULT 'both',
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "teacherName" VARCHAR(255),
        "groupName" VARCHAR(100),
        "subgroup" VARCHAR(50),
        "department" VARCHAR(255),
        "faculty" VARCHAR(255),
        "notes" TEXT,
        "isChanged" BOOLEAN DEFAULT false,
        "changeDescription" TEXT,
        "source" VARCHAR(50),
        "externalId" VARCHAR(100),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lessons_university_group_dayofweek" ON "lessons" ("universityId", "groupId", "dayOfWeek")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lessons_university_teacher_dayofweek" ON "lessons" ("universityId", "teacherId", "dayOfWeek")
    `);

    await queryRunner.query(`
      CREATE TABLE "lesson_changes" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "lessonId" UUID NOT NULL,
        "changeType" VARCHAR(50) NOT NULL,
        "oldValues" JSONB,
        "newValues" JSONB,
        "changedBy" UUID,
        "changedAt" TIMESTAMP DEFAULT NOW(),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_lesson_changes_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "pair_spaces" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "universityId" UUID NOT NULL,
        "lessonId" UUID NOT NULL,
        "subject" VARCHAR(255),
        "date" TIMESTAMP,
        "pairNumber" INTEGER,
        "teacherName" VARCHAR(255),
        "group" VARCHAR(100),
        "room" VARCHAR(50),
        "isActive" BOOLEAN DEFAULT true,
        "activeUntil" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "announcements" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "pairSpaceId" UUID NOT NULL,
        "authorId" UUID NOT NULL,
        "text" TEXT NOT NULL,
        "isPinned" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_announcements_pair_space" FOREIGN KEY ("pairSpaceId") REFERENCES "pair_spaces"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "homeworks" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "pairSpaceId" UUID NOT NULL,
        "authorId" UUID NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "deadline" TIMESTAMP,
        "isRecurring" BOOLEAN DEFAULT false,
        "recurringRule" VARCHAR(100),
        "isCompleted" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_homeworks_pair_space" FOREIGN KEY ("pairSpaceId") REFERENCES "pair_spaces"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "homework_submissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "homeworkId" UUID NOT NULL,
        "studentId" UUID NOT NULL,
        "status" VARCHAR(20) DEFAULT 'not_submitted',
        "submittedAt" TIMESTAMP,
        "fileUrl" VARCHAR(500),
        "comment" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_homework_submissions_homework" FOREIGN KEY ("homeworkId") REFERENCES "homeworks"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "file_attachments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "pairSpaceId" UUID NOT NULL,
        "uploadedBy" UUID NOT NULL,
        "fileUrl" VARCHAR(500) NOT NULL,
        "fileName" VARCHAR(255) NOT NULL,
        "fileType" VARCHAR(10) NOT NULL,
        "size" INTEGER NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_file_attachments_pair_space" FOREIGN KEY ("pairSpaceId") REFERENCES "pair_spaces"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "discussion_messages" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "pairSpaceId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "text" TEXT NOT NULL,
        "parentId" UUID,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_discussion_messages_pair_space" FOREIGN KEY ("pairSpaceId") REFERENCES "pair_spaces"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "absences" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "universityId" UUID NOT NULL,
        "studentId" UUID NOT NULL,
        "type" VARCHAR(20) NOT NULL,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP,
        "comment" TEXT,
        "isSensitive" BOOLEAN DEFAULT false,
        "confirmationRequired" BOOLEAN DEFAULT true,
        "affectedLessonIds" TEXT,
        "affectedLessonsCount" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "absence_confirmations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "absenceId" UUID NOT NULL,
        "curatorId" UUID NOT NULL,
        "status" VARCHAR(20) DEFAULT 'pending',
        "comment" TEXT,
        "confirmedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_absence_confirmations_absence" FOREIGN KEY ("absenceId") REFERENCES "absences"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "universityId" UUID NOT NULL,
        "type" VARCHAR(50) NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "body" TEXT NOT NULL,
        "deepLink" VARCHAR(500),
        "isRead" BOOLEAN DEFAULT false,
        "readAt" TIMESTAMP,
        "data" JSONB,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "device_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "token" VARCHAR(500) NOT NULL,
        "platform" VARCHAR(10) NOT NULL,
        "deviceName" VARCHAR(255),
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "action" VARCHAR(100) NOT NULL,
        "entity" VARCHAR(100) NOT NULL,
        "entityId" UUID,
        "oldValues" JSONB,
        "newValues" JSONB,
        "ip" VARCHAR(50),
        "userAgent" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "absence_confirmations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "absences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "discussion_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "homework_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "homeworks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pair_spaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_changes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lessons_university_teacher_dayofweek"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lessons_university_group_dayofweek"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lessons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teachers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "faculties"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "universities"`);
  }
}
