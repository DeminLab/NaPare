import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TZ 11.2/11.3: the semester rule behind `GET /schedule/week-type`.
 * `week1Anchor` is the Monday of week 1, `week1Type` its parity and
 * `cycleLength` how many weeks the pattern repeats (TZ 11.3 formula).
 * Date columns hydrate to 'YYYY-MM-DD' strings through TypeORM.
 */
@Entity('academic_term')
@Unique('UQ_academic_term_organization_starts', ['organizationId', 'startsOn'])
@Check(`"endsOn" >= "startsOn"`)
export class AcademicTerm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'date' })
  startsOn: string;

  @Column({ type: 'date' })
  endsOn: string;

  @Column({ type: 'int' })
  cycleLength: number;

  @Column({ type: 'date' })
  week1Anchor: string;

  @Column({ type: 'varchar' })
  week1Type: 'odd' | 'even';

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz' })
  updatedAt: Date;
}
