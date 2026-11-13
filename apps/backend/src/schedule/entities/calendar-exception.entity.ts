import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TZ 11.3 priority layer: a manual week-parity override for a concrete date
 * (`exceptionDate`) or a week number (`weekNumber`), optionally scoped to a
 * group/faculty for a later endpoint parameter. Exceptions without `weekType`
 * (каникулы, сессия) are informational: they never shift the parity unless the
 * university explicitly says otherwise (TZ 11.3).
 */
@Entity('calendar_exception')
@Index('IDX_calendar_exception_org_date', ['organizationId', 'exceptionDate'])
@Index('IDX_calendar_exception_org_week', ['organizationId', 'weekNumber'])
@Check(`"exceptionDate" IS NOT NULL OR "weekNumber" IS NOT NULL`)
export class CalendarException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'date', nullable: true })
  exceptionDate: string | null;

  @Column({ type: 'int', nullable: true })
  weekNumber: number | null;

  /** Explicit parity override; `null` keeps the semester rule (TZ 11.3). */
  @Column({ type: 'varchar', nullable: true })
  weekType: 'odd' | 'even' | null;

  /** Free-form classification, e.g. `vacation`, `session`, `holiday`. */
  @Column({ type: 'varchar', nullable: true })
  kind: string | null;

  @Column({ type: 'uuid', nullable: true })
  groupId: string | null;

  @Column({ type: 'uuid', nullable: true })
  facultyId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;
}
