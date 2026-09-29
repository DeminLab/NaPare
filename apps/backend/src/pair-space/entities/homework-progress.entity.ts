import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const HOMEWORK_PROGRESS_STATES = ['todo', 'in_progress', 'done'] as const;
export type HomeworkProgressState = typeof HOMEWORK_PROGRESS_STATES[number];

export interface HomeworkProgressSubtask {
  id: string;
  title: string;
  done: boolean;
}

@Entity('homework_progress')
@Index('UQ_homework_progress_homework_student', ['homeworkId', 'studentId'], { unique: true })
@Index('IDX_homework_progress_student', ['studentId'])
export class HomeworkProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  homeworkId: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @Column({ type: 'varchar', length: 16, default: 'todo' })
  state: HomeworkProgressState;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  subtasks: HomeworkProgressSubtask[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
