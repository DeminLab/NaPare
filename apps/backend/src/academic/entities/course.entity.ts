import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { ProvenanceSyncStatus } from '../academic.types';

@Entity('academic_courses')
@Index('UQ_academic_courses_university_code', ['universityId', 'code'], { unique: true })
@Index('IDX_academic_courses_university_name', ['universityId', 'name'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'uuid', nullable: true })
  facultyId: string | null;

  @Column({ length: 100 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', nullable: true })
  credits: number | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  source: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ nullable: true })
  sourceVersion: string | null;

  @Column({ type: 'varchar', default: 'unknown' })
  syncStatus: ProvenanceSyncStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
