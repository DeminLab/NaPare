import { MigrationInterface, QueryRunner } from 'typeorm';
export class CareerAiDrafts1700000000018 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE career_portfolio ADD COLUMN "caseText" text NOT NULL DEFAULT ''`);
    await runner.query(`CREATE TABLE career_ai_request (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, kind varchar NOT NULL CHECK (kind IN ('task','portfolio')), state varchar NOT NULL DEFAULT 'started' CHECK (state IN ('started','success','failed')), "createdAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`CREATE INDEX career_ai_request_user_day ON career_ai_request ("userId", "createdAt")`);
    await runner.query(`CREATE INDEX career_ai_request_day ON career_ai_request ("createdAt")`);
  }
  async down(): Promise<void> { throw new Error('Preserve case descriptions and AI request records; explicit data migration required.'); }
}
