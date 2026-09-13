import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { University } from './university.entity';
import { Faculty } from './faculty.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  facultyId: string;

  @ManyToOne(() => Faculty, (faculty) => faculty.groups)
  @JoinColumn({ name: 'facultyId' })
  faculty: Faculty;

  @Column({ type: 'uuid' })
  universityId: string;

  @ManyToOne(() => University, (university) => university.groups)
  @JoinColumn({ name: 'universityId' })
  university: University;

  @Column()
  name: string;

  @Column({ type: 'int' })
  curriculumYear: number;

  @Column({ nullable: true })
  specialization: string;

  @Column({ type: 'uuid', nullable: true })
  curatorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
