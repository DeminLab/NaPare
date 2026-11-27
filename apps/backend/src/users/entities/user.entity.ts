import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from "typeorm";
import { Exclude } from "class-transformer";
import { UserRole } from "../../auth/interfaces/user-role";

@Entity("users")
@Check("CHK_users_email_or_linked_teacher", '"email" IS NOT NULL OR ("role" = \'teacher\' AND "sourceTeacherId" IS NOT NULL)')
@Index("IDX_users_organization_id", ["organizationId"])
@Index("UQ_users_university_source_teacher", ["organizationId", "sourceTeacherId"], { unique: true, where: '"sourceTeacherId" IS NOT NULL' })
@Index("IDX_users_max_user_id", ["maxUserId"], { unique: true })
@Index("IDX_users_telegram_user_id", ["telegramUserId"], { unique: true })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  email: string | null;

  /** Administrator-assigned sign-in identifier; legacy accounts need assignment before login. */
  @Column({ type: "varchar", length: 32, nullable: true })
  username: string | null;

  @Column()
  @Exclude()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role: UserRole;

  @Column({ type: "uuid", nullable: true })
  organizationId: string | null;

  @Column({ type: "varchar", nullable: true })
  groupId: string;

  /** Stable teacher identifier from the university schedule source. */
  @Column({ type: "varchar", nullable: true })
  sourceTeacherId: string | null;

  @Column({ type: "varchar", nullable: true })
  maxUserId: string | null;

  @Column({ type: "varchar", nullable: true })
  @Exclude()
  telegramUserId: string | null;

  @Column({ default: true })
  isActive: boolean;

  /** Reversible platform archive; access is disabled while the account is archived. */
  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date | null;

  /** Whether access was enabled before archiving, restored when the account is unarchived. */
  @Column({ type: 'boolean', nullable: true })
  archivedWasActive: boolean | null;

  /**
   * Invalidates every access and refresh token issued before the latest bump.
   * The value is embedded in JWTs and checked for every authenticated request.
   */
  @Column({ type: "integer", default: 0 })
  sessionVersion: number;

  /** Irreversible local account tombstone, distinct from an administrative block. */
  @Column({ type: 'timestamp', nullable: true })
  personalDataDeletedAt: Date | null;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
