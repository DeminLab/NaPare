import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

/**
 * ADR-0009 expand: tenant-scoped role memberships. `users.role` stays the
 * single-role mirror of the active organization during the dual-write window;
 * this table is the source of truth for effective roles (read by JwtStrategy).
 * The role check constraint is wider than the backend enum on purpose: the
 * canonical TZ roles (group_leader, registrar, parent, dorm_manager,
 * practice_supervisor) arrive with their own feature drops.
 */
@Entity("user_role")
@Index("IDX_user_role_user_organization", ["userId", "organizationId"])
@Unique("UQ_user_role_membership", ["userId", "organizationId", "role"])
@Check(
  `"role" IN ('student','group_leader','teacher','curator','registrar','dorm_manager','practice_supervisor','parent','faculty_dean','department_head','university_admin','developer','superadmin','employer','career_staff','career_admin')`,
)
export class UserRoleMembership {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "userId", type: "uuid" })
  userId: string;

  @Column({ name: "organizationId", type: "uuid" })
  organizationId: string;

  @Column({ type: "varchar" })
  role: string;

  /** `{ facultyId?, departmentId?, groupIds?, studentIds?, requestIds? }`; `{}` = whole role area. */
  @Column({ type: "jsonb", default: () => "'{}'" })
  scope: Record<string, unknown>;

  @CreateDateColumn({ name: "createdAt", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updatedAt", type: "timestamptz" })
  updatedAt: Date;
}
