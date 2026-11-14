import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const LINK_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type LinkRequestStatus = (typeof LINK_REQUEST_STATUSES)[number];

/**
 * TZ 9.2 / FR-ONB-04 expand: a student's fallback request to be linked when
 * the invite claim fails; staff approve or reject it from the queue
 * (FR-STF-04). The row is created before an account exists, so it is not part
 * of a personal export (classified in PERSONAL_EXPORT_EXCLUDED_TABLES).
 */
@Entity('link_request')
@Check(`"status" IN ('pending', 'approved', 'rejected')`)
@Index('IDX_link_request_organization_status_created', [
  'organizationId',
  'status',
  'createdAt',
])
@Index('IDX_link_request_organization_email', [
  'organizationId',
  'studentEmail',
])
export class LinkRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar' })
  studentEmail: string;

  /** Name entered by the requester; staff verifies it against the account. */
  @Column({ type: 'varchar' })
  studentFullName: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status: LinkRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
