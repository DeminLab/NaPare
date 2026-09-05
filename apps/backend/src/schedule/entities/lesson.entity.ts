import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('lessons')
@Index(['universityId', 'date', 'pairNumber'])
@Index(['universityId', 'teacherId', 'date'])
@Index(['universityId', 'group', 'date'])
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column()
  date: Date;

  @Column({ type: 'int' })
  pairNumber: number;

  @Column()
  startTime: string;

  @Column()
  endTime: string;

  @Column()
  subject: string;

  @Column({ nullable: true })
  subjectType: string;

  @Column({ nullable: true })
  teacherName: string;

  @Column({ nullable: true })
  teacherId: string;

  @Column({ nullable: true })
  room: string;

  @Column({ nullable: true })
  building: string;

  @Column({ nullable: true })
  group: string;

  @Column({ nullable: true })
  subgroup: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  faculty: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: false })
  isChanged: boolean;

  @Column({ nullable: true })
  changeDescription: string;

  @Column({ nullable: true })
  source: string;

  @Column({ nullable: true })
  externalId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
