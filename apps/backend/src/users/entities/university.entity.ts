import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { Faculty } from './faculty.entity';
import { Group } from './group.entity';

@Entity('universities')
export class University {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  city: string;

  @Column({ nullable: true })
  connectorType: string;

  @Column({ type: 'jsonb', nullable: true })
  connectorConfig: Record<string, unknown>;

  /** FR-IMP-08: mass-change confirmation threshold in percent (0–100); the empty-snapshot gate is independent. */
  @Column({ type: 'int', default: 30 })
  importMassChangeThreshold: number;

  /** Cabinet opt-in for exposing this university's imported timetable publicly. */
  @Column({ type: 'boolean', default: false })
  publicScheduleEnabled: boolean;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'pending'],
    default: 'pending',
  })
  status: string;

  @OneToMany(() => Faculty, (faculty) => faculty.university)
  faculties: Faculty[];

  @OneToMany(() => Group, (group) => group.university)
  groups: Group[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
