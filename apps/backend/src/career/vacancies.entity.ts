import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('career_vacancy')
@Index('UQ_career_vacancy_scope', ['id', 'organizationId', 'companyId'], { unique: true })
@Index('IDX_career_vacancy_catalog', ['organizationId', 'status', 'createdAt'])
@Index('IDX_career_vacancy_company', ['companyId', 'createdAt'])
@Check('CHK_career_vacancy_status', "status IN ('pending', 'open', 'rejected', 'closed')")
@Check('CHK_career_vacancy_kind', "kind IN ('job', 'internship')")
export class CareerVacancy {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @Column('uuid') companyId: string;
  @Column('varchar', { length: 160 }) title: string;
  @Column('text') description: string;
  @Column('varchar') kind: 'job' | 'internship';
  @Column('varchar', { default: 'pending' }) status: 'pending' | 'open' | 'rejected' | 'closed';
  @Column('text', { default: '' }) reviewReason: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export interface VacancyResume {
  name: string;
  headline: string;
  about: string;
  skills: string[];
}

@Entity('career_vacancy_application')
@Index('UQ_career_vacancy_applicant', ['vacancyId', 'studentId'], { unique: true })
@Index('IDX_career_vacancy_student_interviews', ['studentId', 'status', 'startsAt'])
@Check('CHK_career_vacancy_application_status', "status IN ('submitted', 'proposed', 'confirmed', 'declined')")
@Check('CHK_career_vacancy_interview_window', `("startsAt" IS NULL AND "endsAt" IS NULL AND status = 'submitted') OR
  ("startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt" AND status <> 'submitted')`)
export class CareerVacancyApplication {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @Column('uuid') companyId: string;
  @Column('uuid') vacancyId: string;
  @Column('uuid') studentId: string;
  @Column('jsonb') resume: VacancyResume;
  @Column('varchar', { default: 'submitted' }) status: 'submitted' | 'proposed' | 'confirmed' | 'declined';
  @Column('timestamptz', { nullable: true }) startsAt: Date | null;
  @Column('timestamptz', { nullable: true }) endsAt: Date | null;
  @Column('text', { default: '' }) meetingDetails: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
