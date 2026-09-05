import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('absences')
export class Absence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @Column({ type: 'uuid', nullable: true })
  lessonId: string;

  @Column()
  date: Date;

  @Column({ type: 'int' })
  pairNumber: number;

  @Column()
  subject: string;

  @Column({
    type: 'enum',
    enum: ['absent', 'late', 'excused', 'pending'],
    default: 'pending',
  })
  status: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  confirmedBy: string;

  @Column({ nullable: true })
  confirmedAt: Date;

  @Column({ default: false })
  isExcused: boolean;

  @Column({ nullable: true })
  excusedBy: string;

  @Column({ nullable: true })
  excusedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
