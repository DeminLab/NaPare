import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

import { University } from './university.entity';
import { Group } from './group.entity';

@Entity('faculties')
@Index('IDX_faculties_university_name', ['organizationId', 'name'])
export class Faculty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => University, (university) => university.faculties)
  @JoinColumn({ name: 'organizationId' })
  university: University;

  @Column()
  name: string;

  @Column()
  code: string;

  @Column({ type: 'uuid', nullable: true })
  deanUserId: string | null;

  @OneToMany(() => Group, (group) => group.faculty)
  groups: Group[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
