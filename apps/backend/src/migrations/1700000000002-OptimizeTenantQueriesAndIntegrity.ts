import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeTenantQueriesAndIntegrity1700000000002
  implements MigrationInterface
{
  name = 'OptimizeTenantQueriesAndIntegrity1700000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    const duplicatePairSpaces = await queryRunner.query(`
      SELECT "lessonId"
      FROM "pair_spaces"
      GROUP BY "lessonId"
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (duplicatePairSpaces.length > 0) {
      throw new Error(
        'Cannot add UQ_pair_spaces_lesson_id: duplicate PairSpaces exist for one lesson.',
      );
    }

    const duplicateSubmissions = await queryRunner.query(`
      SELECT "homeworkId", "studentId"
      FROM "homework_submissions"
      GROUP BY "homeworkId", "studentId"
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (duplicateSubmissions.length > 0) {
      throw new Error(
        'Cannot add UQ_homework_submissions_homework_student: duplicate submissions exist.',
      );
    }

    const duplicateDeviceTokens = await queryRunner.query(`
      SELECT "token"
      FROM "device_tokens"
      GROUP BY "token"
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (duplicateDeviceTokens.length > 0) {
      throw new Error(
        'Cannot add UQ_device_tokens_token: duplicate device tokens exist.',
      );
    }

    const invalidAffectedLessonIds = await queryRunner.query(`
      SELECT "id"
      FROM "absences"
      CROSS JOIN LATERAL unnest(string_to_array("affectedLessonIds", ',')) AS lesson_id
      WHERE NULLIF(trim("affectedLessonIds"), '') IS NOT NULL
        AND trim(lesson_id) <> ''
        AND trim(lesson_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      LIMIT 1
    `);
    if (invalidAffectedLessonIds.length > 0) {
      throw new Error(
        'Cannot migrate absences.affectedLessonIds to uuid[]: invalid lesson id found.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "absences"
      ALTER COLUMN "affectedLessonIds" TYPE uuid[]
      USING CASE
        WHEN NULLIF(trim("affectedLessonIds"), '') IS NULL THEN NULL
        ELSE string_to_array("affectedLessonIds", ',')::uuid[]
      END
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_pair_spaces_lesson_id"
      ON "pair_spaces" ("lessonId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_homework_submissions_homework_student"
      ON "homework_submissions" ("homeworkId", "studentId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_device_tokens_token"
      ON "device_tokens" ("token")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_university_id" ON "users" ("universityId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_faculties_university_name"
      ON "faculties" ("universityId", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_groups_university_name"
      ON "groups" ("universityId", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_groups_faculty_id" ON "groups" ("facultyId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_teachers_university_id" ON "teachers" ("universityId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lessons_university_start_date_pair_number"
      ON "lessons" ("universityId", "startDate", "pairNumber")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lessons_university_group_start_date_pair_number"
      ON "lessons" ("universityId", "groupId", "startDate", "pairNumber")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lessons_university_teacher_start_date_pair_number"
      ON "lessons" ("universityId", "teacherId", "startDate", "pairNumber")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_changes_lesson_created_at"
      ON "lesson_changes" ("lessonId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_announcements_pair_space_pinned_created_at"
      ON "announcements" ("pairSpaceId", "isPinned" DESC, "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_homeworks_pair_space_deadline"
      ON "homeworks" ("pairSpaceId", "deadline")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_file_attachments_pair_space_id"
      ON "file_attachments" ("pairSpaceId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_discussion_messages_pair_space_created_at"
      ON "discussion_messages" ("pairSpaceId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_absences_university_student_created_at"
      ON "absences" ("universityId", "studentId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_absences_university_start_date"
      ON "absences" ("universityId", "startDate")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_absences_university_created_at"
      ON "absences" ("universityId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_absences_affected_lesson_ids"
      ON "absences" USING GIN ("affectedLessonIds")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_absence_confirmations_absence_id"
      ON "absence_confirmations" ("absenceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_university_created_at"
      ON "notifications" ("userId", "universityId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_university_unread"
      ON "notifications" ("userId", "universityId")
      WHERE "isRead" = false
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_device_tokens_user_active"
      ON "device_tokens" ("userId", "isActive")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_device_tokens_user_active"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_university_unread"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_user_university_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_absences_affected_lesson_ids"`);
    await queryRunner.query(`DROP INDEX "IDX_absences_university_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_absences_university_start_date"`);
    await queryRunner.query(`DROP INDEX "IDX_absences_university_student_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_absence_confirmations_absence_id"`);
    await queryRunner.query(`DROP INDEX "IDX_discussion_messages_pair_space_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_file_attachments_pair_space_id"`);
    await queryRunner.query(`DROP INDEX "IDX_homeworks_pair_space_deadline"`);
    await queryRunner.query(`DROP INDEX "IDX_announcements_pair_space_pinned_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_lesson_changes_lesson_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_lessons_university_teacher_start_date_pair_number"`);
    await queryRunner.query(`DROP INDEX "IDX_lessons_university_group_start_date_pair_number"`);
    await queryRunner.query(`DROP INDEX "IDX_lessons_university_start_date_pair_number"`);
    await queryRunner.query(`DROP INDEX "IDX_groups_university_name"`);
    await queryRunner.query(`DROP INDEX "IDX_groups_faculty_id"`);
    await queryRunner.query(`DROP INDEX "IDX_faculties_university_name"`);
    await queryRunner.query(`DROP INDEX "IDX_teachers_university_id"`);
    await queryRunner.query(`DROP INDEX "IDX_users_university_id"`);
    await queryRunner.query(`DROP INDEX "UQ_device_tokens_token"`);
    await queryRunner.query(`DROP INDEX "UQ_homework_submissions_homework_student"`);
    await queryRunner.query(`DROP INDEX "UQ_pair_spaces_lesson_id"`);

    await queryRunner.query(`
      ALTER TABLE "absences"
      ALTER COLUMN "affectedLessonIds" TYPE TEXT
      USING array_to_string("affectedLessonIds", ',')
    `);
  }
}
