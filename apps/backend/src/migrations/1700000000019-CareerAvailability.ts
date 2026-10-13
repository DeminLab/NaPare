import { MigrationInterface, QueryRunner } from 'typeorm';
export class CareerAvailability1700000000019 implements MigrationInterface {
  async up(runner:QueryRunner):Promise<void> {
    await runner.query(`CREATE TABLE career_availability ("studentId" uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT, "universityId" uuid NOT NULL REFERENCES universities(id), "weeklyHours" integer NOT NULL CHECK ("weeklyHours" BETWEEN 1 AND 40), "timeZone" varchar NOT NULL, windows jsonb NOT NULL, "blockedDates" jsonb NOT NULL DEFAULT '[]', "updatedAt" timestamptz NOT NULL DEFAULT now())`);
    await runner.query(`ALTER TABLE career_task ADD COLUMN level varchar NOT NULL DEFAULT 'standard' CHECK (level IN ('starter','standard','advanced')), ADD COLUMN requirements text NOT NULL DEFAULT ''`);
    await runner.query(`ALTER TABLE career_admission ADD COLUMN basis varchar NOT NULL DEFAULT 'unspecified' CHECK (basis IN ('unspecified','test','center'))`);
  }
  async down():Promise<void> {throw new Error('Availability and skill evidence must be preserved; explicit data migration required.');}
}
