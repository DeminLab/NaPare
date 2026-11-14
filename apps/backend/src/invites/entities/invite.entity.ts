import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TZ 9.2 / FR-ONB-02 expand: a personal onboarding invite.
 *
 * - `tokenHash` is the only representation of the shareable link token:
 *   sha256 hex, unique, so the plaintext exists only in the creation response.
 * - `factorHash` is the bcrypt of the approved second factor value
 *   (FR-ONB-03); the plaintext factor is never stored.
 * - `attempts`/`maxAttempts` implement the per-invite attempt limit of
 *   SEC-09, `expiresAt` its default 14-day lifetime (FR-ONB-02).
 * - The public claim path reaches rows only through a relation capability on
 *   `tokenHash` (migration 1700000000049), never through organization scope.
 */
@Entity('invite')
@Index('IDX_invite_organization_created', ['organizationId', 'createdAt'])
@Index('IDX_invite_student', ['studentId'])
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid', nullable: true })
  groupId: string | null;

  /** Existing account the invite binds; created through admin user management. */
  @Column({ type: 'uuid', nullable: true })
  studentId: string | null;

  @Column({ type: 'varchar', nullable: true })
  studentEmail: string | null;

  /** Entered by the student at claim time; the public payload never returns it. */
  @Column({ type: 'varchar' })
  expectedFullName: string;

  /** Second factor type from the organization-approved set. */
  @Column({ type: 'varchar' })
  factorType: string;

  @Column({ type: 'varchar' })
  factorHash: string;

  @Column({ type: 'varchar', unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  claimedUserId: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'integer', default: 5 })
  maxAttempts: number;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
