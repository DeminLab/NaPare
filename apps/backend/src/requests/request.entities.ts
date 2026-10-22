import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { JsonObject } from '../common/types/json-value.type';

export const REQUEST_TYPES = ['absence', 'transfer', 'retake'] as const;
export type RequestType = typeof REQUEST_TYPES[number];
export const REQUEST_STATUSES = ['draft', 'submitted', 'in_review', 'needs_changes', 'approved', 'rejected', 'withdrawn', 'closed'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];
export const OFFICE_DUTIES = ['office', 'methodologist', 'dispatcher'] as const;
export type OfficeDuty = typeof OFFICE_DUTIES[number];
export type StepDuty = 'office' | 'methodologist' | 'curator_or_dean' | 'dean';

@Entity('office_assignments')
@Index('IDX_office_assignment_actor', ['universityId', 'userId'])
export class OfficeAssignment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') universityId: string;
  @Column('uuid') userId: string;
  @Column('varchar') duty: OfficeDuty;
  @Column('uuid', { array: true, default: '{}' }) facultyIds: string[];
  @Column('uuid', { array: true, default: '{}' }) groupIds: string[];
  @Column('boolean', { default: false }) canCreateForStudents: boolean;
  @Column('uuid') assignedBy: string;
  @Column('timestamp', { nullable: true }) revokedAt: Date | null;
  @Column('uuid', { nullable: true }) revokedBy: string | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('office_routes')
@Index('UQ_office_route_group_type', ['universityId', 'groupId', 'type'], { unique: true })
export class OfficeRoute {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') universityId: string;
  @Column('uuid') groupId: string;
  @Column('varchar') type: RequestType;
  @Column('uuid', { array: true }) assigneeIds: string[];
  @Column('integer', { default: 1 }) version: number;
  @Column('integer', { default: 5 }) dueDays: number;
  @Column('uuid') configuredBy: string;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('student_requests')
@Index('UQ_student_request_create_key', ['universityId', 'createdBy', 'createKey'], { unique: true })
@Index('IDX_student_request_queue', ['universityId', 'groupId', 'status'])
export class StudentRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') universityId: string;
  @Column('uuid') studentId: string;
  @Column('uuid') groupId: string;
  @Column('uuid') facultyId: string;
  @Column('varchar') type: RequestType;
  @Column('varchar', { default: 'draft' }) status: RequestStatus;
  @Column('varchar', { length: 200 }) title: string;
  @Column('text') description: string;
  @Column('uuid', { nullable: true }) assignedTo: string | null;
  @Column('timestamp', { nullable: true }) dueAt: Date | null;
  @Column('integer', { default: 1 }) workflowVersion: number;
  @Column('integer', { default: 1 }) version: number;
  @Column('uuid') createdBy: string;
  @Column('uuid') createKey: string;
  @Column('varchar', { length: 64 }) createHash: string;
  @Column('timestamp', { nullable: true }) submittedAt: Date | null;
  @Column('timestamp', { nullable: true }) closedAt: Date | null;
  @Column('varchar', { length: 300, nullable: true }) resultReference: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('request_steps')
@Index('UQ_request_step_sequence', ['requestId', 'sequence'], { unique: true })
export class RequestStep {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') universityId: string;
  @Column('uuid') requestId: string;
  @Column('integer') sequence: number;
  @Column('varchar') duty: StepDuty;
  @Column('uuid') assigneeId: string;
  @Column('varchar', { default: 'pending' }) state: 'pending' | 'approved' | 'rejected';
  @Column('timestamp') dueAt: Date;
  @Column('uuid', { nullable: true }) decidedBy: string | null;
  @Column('timestamp', { nullable: true }) decidedAt: Date | null;
  @Column('text', { nullable: true }) reason: string | null;
}

@Entity('request_decisions')
@Index('UQ_request_decision_command', ['requestId', 'actorId', 'idempotencyKey'], { unique: true })
export class RequestDecision {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') universityId: string;
  @Column('uuid') requestId: string;
  @Column('uuid', { nullable: true }) stepId: string | null;
  @Column('uuid') actorId: string;
  @Column('varchar') action: string;
  @Column('varchar') fromStatus: RequestStatus;
  @Column('varchar') toStatus: RequestStatus;
  @Column('text') reason: string;
  @Column('uuid') idempotencyKey: string;
  @Column('varchar', { length: 64 }) payloadHash: string;
  @Column('jsonb') response: { id: string; status: RequestStatus; version: number };
  @Column('jsonb', { default: {} }) details: JsonObject;
  @CreateDateColumn() createdAt: Date;
}

@Entity('request_documents')
@Index('UQ_request_document_attachment', ['requestId', 'attachmentId'], { unique: true })
export class RequestDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') universityId: string;
  @Column('uuid') requestId: string;
  @Column('uuid') attachmentId: string;
  @Column('uuid') addedBy: string;
  @CreateDateColumn() createdAt: Date;
}

export const REQUEST_ENTITIES = [OfficeAssignment, OfficeRoute, StudentRequest, RequestStep, RequestDecision, RequestDocument];
