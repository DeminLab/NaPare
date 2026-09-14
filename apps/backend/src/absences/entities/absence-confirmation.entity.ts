import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Absence } from './absence.entity';

@Entity('absence_confirmations')
@Index('IDX_absence_confirmations_absence_id', ['absenceId'])
export class AbsenceConfirmation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  absenceId: string;

  @ManyToOne(() => Absence)
  @JoinColumn({ name: 'absenceId' })
  absence: Absence;

  @Column({ type: 'uuid' })
  curatorId: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending',
  })
  status: string;

  @Column({ nullable: true })
  comment: string;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
