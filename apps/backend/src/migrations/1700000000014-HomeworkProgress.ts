import { MigrationInterface, QueryRunner } from 'typeorm';

export class HomeworkProgress1700000000014 implements MigrationInterface {
  name = 'HomeworkProgress1700000000014';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "homework_progress" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "homeworkId" uuid NOT NULL,
      "studentId" uuid NOT NULL,
      "state" character varying(16) NOT NULL DEFAULT 'todo',
      "subtasks" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_homework_progress" PRIMARY KEY ("id"),
      CONSTRAINT "FK_homework_progress_homework" FOREIGN KEY ("homeworkId") REFERENCES "homeworks"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_homework_progress_student" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "CHK_homework_progress_state" CHECK ("state" IN ('todo', 'in_progress', 'done'))
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_homework_progress_homework_student" ON "homework_progress" ("homeworkId", "studentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_homework_progress_student" ON "homework_progress" ("studentId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_homework_progress_student"`);
    await queryRunner.query(`DROP INDEX "UQ_homework_progress_homework_student"`);
    await queryRunner.query(`DROP TABLE "homework_progress"`);
  }
}
