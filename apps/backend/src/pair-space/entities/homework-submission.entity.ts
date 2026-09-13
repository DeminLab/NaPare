import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Homework } from './homework.entity';

@Entity('homework_submissions')
export class HomeworkSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  homeworkId: string;

  @ManyToOne(() => Homework)
  @JoinColumn({ name: 'homeworkId' })
  homework: Homework;

  @Column({ type: 'uuid' })
  studentId: string;

  @Column({
    type: 'enum',
    enum: ['not_submitted', 'submitted'],
    default: 'not_submitted',
  })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
