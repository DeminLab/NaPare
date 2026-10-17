import { MigrationInterface, QueryRunner } from 'typeorm';

export class SibitTeacherLinks1700000000023 implements MigrationInterface {
  name = 'SibitTeacherLinks1700000000023';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "users" ADD COLUMN "sourceTeacherId" varchar`);
    await runner.query(`ALTER TABLE "lessons" ADD COLUMN "sourceTeacherId" varchar`);
    await runner.query(`CREATE UNIQUE INDEX "UQ_users_university_source_teacher" ON "users" ("universityId", "sourceTeacherId") WHERE "sourceTeacherId" IS NOT NULL`);
    await runner.query(`CREATE INDEX "IDX_lessons_university_source_teacher" ON "lessons" ("universityId", "sourceTeacherId")`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP INDEX "IDX_lessons_university_source_teacher"`);
    await runner.query(`DROP INDEX "UQ_users_university_source_teacher"`);
    await runner.query(`ALTER TABLE "lessons" DROP COLUMN "sourceTeacherId"`);
    await runner.query(`ALTER TABLE "users" DROP COLUMN "sourceTeacherId"`);
  }
}
