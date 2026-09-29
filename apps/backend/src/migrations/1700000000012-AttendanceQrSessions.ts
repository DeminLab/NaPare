import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceQrSessions1700000000012 implements MigrationInterface {
  name = 'AttendanceQrSessions1700000000012';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendance_qr_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "universityId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "createdById" uuid,
        "tokenHash" character varying(64) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendance_qr_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attendance_qr_sessions_university" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attendance_qr_sessions_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attendance_qr_sessions_creator" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_attendance_qr_sessions_token_hash" ON "attendance_qr_sessions" ("tokenHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_qr_sessions_lesson_expiry" ON "attendance_qr_sessions" ("universityId", "lessonId", "expiresAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_qr_sessions_university_expiry" ON "attendance_qr_sessions" ("universityId", "expiresAt")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_attendance_qr_sessions_university_expiry"`);
    await queryRunner.query(`DROP INDEX "IDX_attendance_qr_sessions_lesson_expiry"`);
    await queryRunner.query(`DROP INDEX "UQ_attendance_qr_sessions_token_hash"`);
    await queryRunner.query(`DROP TABLE "attendance_qr_sessions"`);
  }
}
