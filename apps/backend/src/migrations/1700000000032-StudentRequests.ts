import { MigrationInterface, QueryRunner } from 'typeorm';
import { TenantRowSecurity1700000000029 } from './1700000000029-TenantRowSecurity';

export class StudentRequests1700000000032 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE student_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL REFERENCES universities(id),
      "studentId" uuid NOT NULL REFERENCES users(id), "groupId" uuid NOT NULL REFERENCES groups(id), "facultyId" uuid NOT NULL REFERENCES faculties(id),
      type varchar NOT NULL CHECK (type IN ('absence','transfer','retake')), status varchar NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','in_review','needs_changes','approved','rejected','withdrawn','closed')),
      title varchar(200) NOT NULL, description text NOT NULL, "assignedTo" uuid NULL REFERENCES users(id), "dueAt" timestamp NULL,
      "workflowVersion" integer NOT NULL DEFAULT 1, version integer NOT NULL DEFAULT 1,
      "createdBy" uuid NOT NULL REFERENCES users(id), "createKey" uuid NOT NULL, "createHash" varchar(64) NOT NULL,
      "submittedAt" timestamp NULL, "closedAt" timestamp NULL, "resultReference" varchar(300) NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_student_request_create_key" UNIQUE ("universityId","createdBy","createKey")
    ); CREATE INDEX "IDX_student_request_queue" ON student_requests ("universityId","groupId",status);
    CREATE TABLE request_steps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL REFERENCES universities(id),
      "requestId" uuid NOT NULL REFERENCES student_requests(id), sequence integer NOT NULL CHECK (sequence BETWEEN 0 AND 2),
      duty varchar NOT NULL, "assigneeId" uuid NOT NULL REFERENCES users(id), state varchar NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
      "dueAt" timestamp NOT NULL, "decidedBy" uuid NULL REFERENCES users(id), "decidedAt" timestamp NULL, reason text NULL,
      CONSTRAINT "UQ_request_step_sequence" UNIQUE ("requestId",sequence)
    ); CREATE TABLE request_decisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL REFERENCES universities(id),
      "requestId" uuid NOT NULL REFERENCES student_requests(id), "stepId" uuid NULL REFERENCES request_steps(id),
      "actorId" uuid NOT NULL REFERENCES users(id), action varchar NOT NULL, "fromStatus" varchar NOT NULL, "toStatus" varchar NOT NULL,
      reason text NOT NULL, "idempotencyKey" uuid NOT NULL, "payloadHash" varchar(64) NOT NULL, response jsonb NOT NULL, details jsonb NOT NULL DEFAULT '{}',
      "createdAt" timestamp NOT NULL DEFAULT now(), CONSTRAINT "UQ_request_decision_command" UNIQUE ("requestId","actorId","idempotencyKey")
    ); CREATE TABLE request_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "universityId" uuid NOT NULL REFERENCES universities(id),
      "requestId" uuid NOT NULL REFERENCES student_requests(id), "attachmentId" uuid NOT NULL REFERENCES file_attachments(id),
      "addedBy" uuid NOT NULL REFERENCES users(id), "createdAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_request_document_attachment" UNIQUE ("requestId","attachmentId")
    )`);
    await new TenantRowSecurity1700000000029().up(runner);
  }
  async down(runner: QueryRunner): Promise<void> { await runner.query('DROP TABLE request_documents; DROP TABLE request_decisions; DROP TABLE request_steps; DROP TABLE student_requests'); }
}
