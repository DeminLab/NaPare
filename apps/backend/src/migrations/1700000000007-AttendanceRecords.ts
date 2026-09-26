import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceRecords1700000000007 implements MigrationInterface {
  name = 'AttendanceRecords1700000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "attendance_records_status_enum" AS ENUM ('present', 'absent', 'late')`);
    await queryRunner.query(`
      CREATE TABLE "attendance_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "status" "attendance_records_status_enum" NOT NULL DEFAULT 'present',
        "comment" text,
        "markedById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendance_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attendance_records_university" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attendance_records_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attendance_records_student" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attendance_records_marker" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_attendance_records_lesson_student" ON "attendance_records" ("lessonId", "studentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_records_university_lesson" ON "attendance_records" ("universityId", "lessonId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_attendance_records_university_lesson"`);
    await queryRunner.query(`DROP INDEX "UQ_attendance_records_lesson_student"`);
    await queryRunner.query(`DROP TABLE "attendance_records"`);
    await queryRunner.query(`DROP TYPE "attendance_records_status_enum"`);
  }
}
