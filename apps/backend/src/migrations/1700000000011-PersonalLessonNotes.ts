import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersonalLessonNotes1700000000011 implements MigrationInterface {
  name = 'PersonalLessonNotes1700000000011';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "personal_lesson_notes" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "universityId" uuid NOT NULL,
      "pairSpaceId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "content" text NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_personal_lesson_notes" PRIMARY KEY ("id"),
      CONSTRAINT "FK_personal_lesson_notes_university" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_personal_lesson_notes_pair_space" FOREIGN KEY ("pairSpaceId") REFERENCES "pair_spaces"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_personal_lesson_notes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_personal_lesson_notes_pair_space_user" ON "personal_lesson_notes" ("pairSpaceId", "userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_personal_lesson_notes_university_user" ON "personal_lesson_notes" ("universityId", "userId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_personal_lesson_notes_university_user"`);
    await queryRunner.query(`DROP INDEX "UQ_personal_lesson_notes_pair_space_user"`);
    await queryRunner.query(`DROP TABLE "personal_lesson_notes"`);
  }
}
