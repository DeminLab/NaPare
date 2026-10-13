import { MigrationInterface, QueryRunner } from 'typeorm';

export class CareerPlatform1700000000017 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'employer'`);
    await runner.query(`ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'career_staff'`);
    await runner.query(`ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'career_admin'`);
    await runner.query(`ALTER TABLE "users" ALTER COLUMN "universityId" DROP NOT NULL`);
    await runner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_university_or_employer" CHECK ("universityId" IS NOT NULL OR "role"::text = 'employer')`);
    await runner.query(`CREATE TABLE "career_company" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "name" varchar NOT NULL , "description" text NOT NULL DEFAULT '', "createdBy" uuid NOT NULL , "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`ALTER TABLE "career_company" ADD CONSTRAINT "career_company_createdBy_fk" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_company" ADD CONSTRAINT "career_company_check" CHECK (true)`);
    await runner.query(`CREATE TABLE "career_membership" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL , "companyId" uuid , "universityId" uuid , "role" varchar NOT NULL , "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE UNIQUE INDEX "career_membership_userId_companyId_uniq" ON "career_membership" ("userId", "companyId")`);
    await runner.query(`CREATE UNIQUE INDEX "career_membership_userId_universityId_uniq" ON "career_membership" ("userId", "universityId")`);
    await runner.query(`CREATE INDEX "career_membership_university" ON "career_membership" ("universityId")`);
    await runner.query(`ALTER TABLE "career_membership" ADD CONSTRAINT "career_membership_userId_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_membership" ADD CONSTRAINT "career_membership_companyId_fk" FOREIGN KEY ("companyId") REFERENCES "career_company"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_membership" ADD CONSTRAINT "career_membership_universityId_fk" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_membership" ADD CONSTRAINT "career_membership_check" CHECK (("companyId" IS NULL) <> ("universityId" IS NULL))`);
    await runner.query(`CREATE TABLE "career_partnership" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL , "universityId" uuid NOT NULL , "state" varchar NOT NULL DEFAULT 'pending', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE UNIQUE INDEX "career_partnership_companyId_universityId_uniq" ON "career_partnership" ("companyId", "universityId")`);
    await runner.query(`CREATE INDEX "career_partnership_university" ON "career_partnership" ("universityId")`);
    await runner.query(`ALTER TABLE "career_partnership" ADD CONSTRAINT "career_partnership_companyId_fk" FOREIGN KEY ("companyId") REFERENCES "career_company"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_partnership" ADD CONSTRAINT "career_partnership_universityId_fk" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_partnership" ADD CONSTRAINT "career_partnership_check" CHECK (true)`);
    await runner.query(`CREATE TABLE "career_profile" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "studentId" uuid NOT NULL , "universityId" uuid NOT NULL , "headline" varchar NOT NULL , "about" text NOT NULL DEFAULT '', "skills" jsonb NOT NULL DEFAULT '[]'::jsonb, "verification" varchar NOT NULL DEFAULT 'pending', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE UNIQUE INDEX "career_profile_studentId_uniq" ON "career_profile" ("studentId")`);
    await runner.query(`CREATE INDEX "career_profile_university" ON "career_profile" ("universityId")`);
    await runner.query(`ALTER TABLE "career_profile" ADD CONSTRAINT "career_profile_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_profile" ADD CONSTRAINT "career_profile_universityId_fk" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_profile" ADD CONSTRAINT "career_profile_check" CHECK (true)`);
    await runner.query(`CREATE TABLE "career_admission" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "studentId" uuid NOT NULL , "universityId" uuid NOT NULL , "skill" varchar NOT NULL , "evidence" text NOT NULL , "state" varchar NOT NULL DEFAULT 'pending', "reason" text NOT NULL DEFAULT '', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE UNIQUE INDEX "career_admission_studentId_skill_uniq" ON "career_admission" ("studentId", "skill")`);
    await runner.query(`CREATE INDEX "career_admission_university" ON "career_admission" ("universityId")`);
    await runner.query(`ALTER TABLE "career_admission" ADD CONSTRAINT "career_admission_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_admission" ADD CONSTRAINT "career_admission_universityId_fk" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_admission" ADD CONSTRAINT "career_admission_check" CHECK (true)`);
    await runner.query(`CREATE TABLE "career_task" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "companyId" uuid NOT NULL , "universityId" uuid NOT NULL , "title" varchar NOT NULL , "description" text NOT NULL , "criteria" text NOT NULL , "rewardKopecks" integer NOT NULL , "hours" integer NOT NULL , "deadline" date NOT NULL , "profiled" boolean NOT NULL DEFAULT false, "skill" varchar NOT NULL DEFAULT '', "state" varchar NOT NULL DEFAULT 'draft', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE INDEX "career_task_university" ON "career_task" ("universityId")`);
    await runner.query(`ALTER TABLE "career_task" ADD CONSTRAINT "career_task_companyId_fk" FOREIGN KEY ("companyId") REFERENCES "career_company"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_task" ADD CONSTRAINT "career_task_universityId_fk" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_task" ADD CONSTRAINT "career_task_check" CHECK ("rewardKopecks" > 0 AND "hours" > 0)`);
    await runner.query(`CREATE TABLE "career_application" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL , "studentId" uuid NOT NULL , "message" text NOT NULL , "state" varchar NOT NULL DEFAULT 'pending', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE UNIQUE INDEX "career_application_taskId_studentId_uniq" ON "career_application" ("taskId", "studentId")`);
    await runner.query(`ALTER TABLE "career_application" ADD CONSTRAINT "career_application_taskId_fk" FOREIGN KEY ("taskId") REFERENCES "career_task"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_application" ADD CONSTRAINT "career_application_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_application" ADD CONSTRAINT "career_application_check" CHECK (true)`);
    await runner.query(`CREATE TABLE "career_work" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL , "studentId" uuid NOT NULL , "state" varchar NOT NULL DEFAULT 'in_progress', "submission" text NOT NULL DEFAULT '', "resultUrl" text NOT NULL DEFAULT '', "decisionReason" text NOT NULL DEFAULT '', "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE UNIQUE INDEX "career_work_taskId_uniq" ON "career_work" ("taskId")`);
    await runner.query(`ALTER TABLE "career_work" ADD CONSTRAINT "career_work_taskId_fk" FOREIGN KEY ("taskId") REFERENCES "career_task"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_work" ADD CONSTRAINT "career_work_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_work" ADD CONSTRAINT "career_work_check" CHECK (true)`);
    await runner.query(`CREATE TABLE "career_review" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "workId" uuid NOT NULL , "authorId" uuid NOT NULL , "rating" integer NOT NULL , "body" text NOT NULL , "publishAllowed" boolean NOT NULL DEFAULT false, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE UNIQUE INDEX "career_review_workId_uniq" ON "career_review" ("workId")`);
    await runner.query(`ALTER TABLE "career_review" ADD CONSTRAINT "career_review_workId_fk" FOREIGN KEY ("workId") REFERENCES "career_work"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_review" ADD CONSTRAINT "career_review_authorId_fk" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_review" ADD CONSTRAINT "career_review_check" CHECK ("rating" BETWEEN 1 AND 5)`);
    await runner.query(`CREATE TABLE "career_portfolio" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "workId" uuid NOT NULL , "studentId" uuid NOT NULL , "published" boolean NOT NULL DEFAULT false, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE UNIQUE INDEX "career_portfolio_workId_uniq" ON "career_portfolio" ("workId")`);
    await runner.query(`ALTER TABLE "career_portfolio" ADD CONSTRAINT "career_portfolio_workId_fk" FOREIGN KEY ("workId") REFERENCES "career_work"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_portfolio" ADD CONSTRAINT "career_portfolio_studentId_fk" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT`);
    await runner.query(`ALTER TABLE "career_portfolio" ADD CONSTRAINT "career_portfolio_check" CHECK (true)`);
    await runner.query(`CREATE TABLE "career_test" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "universityId" uuid NOT NULL REFERENCES "universities"("id"), "skill" varchar NOT NULL, "title" varchar NOT NULL, "passingPercent" integer NOT NULL DEFAULT 70 CHECK ("passingPercent" BETWEEN 1 AND 100), "questions" jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE("universityId","skill"))`);
    await runner.query(`CREATE TABLE "career_test_attempt" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "testId" uuid NOT NULL REFERENCES "career_test"("id"), "studentId" uuid NOT NULL REFERENCES "users"("id"), "score" integer NOT NULL CHECK ("score" BETWEEN 0 AND 100), "passed" boolean NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE INDEX "career_test_attempt_student" ON "career_test_attempt" ("studentId", "createdAt")`);

    await runner.query(`CREATE TABLE "career_notice" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL REFERENCES "users"("id"), "title" varchar NOT NULL, "body" text NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE INDEX "career_notice_user_created" ON "career_notice" ("userId", "createdAt")`);

  }
  async down(): Promise<void> { throw new Error('Career rollback requires an explicit data migration; records must be preserved.'); }
}
