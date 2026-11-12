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

import { University } from './university.entity';

@Entity('teachers')
@Index('IDX_teachers_organization_id', ['organizationId'])
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => University)
  @JoinColumn({ name: 'organizationId' })
  university: University;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  position: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
