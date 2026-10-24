import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('career_company')
export class CareerCompany {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'varchar'}) name: string;
  @Column({type: 'text', default: ''}) description: string;
  @Column({type: 'varchar', length: 12, nullable: true}) inn: string | null;
  @Column({type: 'varchar', default: 'not_checked'}) registryStatus: string;
  @Column({type: 'timestamp', nullable: true}) registryCheckedAt: Date | null;
  @Column({type: 'timestamp', nullable: true}) registryRequestedAt: Date | null;
  @Column({type: 'text', nullable: true}) registryLegalName: string | null;
  @Column({type: 'varchar', length: 15, nullable: true}) registryOgrn: string | null;
  @Column({type: 'varchar', length: 80, nullable: true}) registryReason: string | null;
  @Column({type: 'integer', default: 0}) registryCheckVersion: number;
  @Column({type: 'uuid'}) createdBy: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_membership')
@Index(['userId', 'companyId'], { unique: true })
@Index(['userId', 'universityId'], { unique: true })
export class CareerMembership {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) userId: string;
  @Column({type: 'uuid', nullable: true}) companyId: string | null;
  @Column({type: 'uuid', nullable: true}) universityId: string | null;
  @Column({type: 'varchar'}) role: string;
  @Column({type: 'timestamptz', nullable: true}) revokedAt: Date | null;
  @Column({type: 'uuid', nullable: true}) revokedBy: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_partnership')
@Index(['companyId', 'universityId'], { unique: true })
export class CareerPartnership {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) companyId: string;
  @Column({type: 'uuid'}) universityId: string;
  @Column({type: 'varchar', default: 'pending'}) state: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_profile')
@Index(['studentId'], { unique: true })
export class CareerProfile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) studentId: string;
  @Column({type: 'uuid'}) universityId: string;
  @Column({type: 'varchar'}) headline: string;
  @Column({type: 'text', default: ''}) about: string;
  @Column({type: 'jsonb', default: []}) skills: string[];
  @Column({type: 'varchar', default: 'pending'}) verification: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_admission')
@Index(['studentId', 'skill'], { unique: true })
export class CareerAdmission {
  @Column({default: 'unspecified'}) basis: string;
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) studentId: string;
  @Column({type: 'uuid'}) universityId: string;
  @Column({type: 'varchar'}) skill: string;
  @Column({type: 'text'}) evidence: string;
  @Column({type: 'varchar', default: 'pending'}) state: string;
  @Column({type: 'text', default: ''}) reason: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_task')
export class CareerTask {
  @Column({type: 'varchar', default: 'not_submitted'}) moderationStatus: string;
  @Column({type: 'jsonb', default: []}) moderationFlags: string[];
  @Column({type: 'varchar', default: ''}) moderationPolicyVersion: string;
  @Column({type: 'text', default: ''}) moderationReason: string;
  @Column({type: 'uuid', nullable: true}) moderationDecidedBy: string | null;
  @Column({type: 'timestamp', nullable: true}) moderationDecidedAt: Date | null;
  @Column({type: 'integer', default: 1}) moderationContentVersion: number;
  @Column({type: 'integer', nullable: true}) moderationReviewedVersion: number | null;
  @Column({default: 'standard'}) level: string;
  @Column({type: 'text', default: ''}) requirements: string;
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) companyId: string;
  @Column({type: 'uuid'}) universityId: string;
  @Column({type: 'varchar'}) title: string;
  @Column({type: 'text'}) description: string;
  @Column({type: 'text'}) criteria: string;
  @Column({type: 'integer'}) rewardKopecks: number;
  @Column({type: 'integer'}) hours: number;
  @Column({type: 'date'}) deadline: string;
  @Column({type: 'boolean', default: false}) profiled: boolean;
  @Column({type: 'varchar', default: ''}) skill: string;
  @Column({type: 'varchar', default: 'draft'}) state: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_task_complaint')
@Index('IDX_career_task_complaint_open', ['taskId', 'studentId'], { unique: true, where: "state = 'open'" })
export class CareerTaskComplaint {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type:'uuid'}) universityId: string;
  @Column({type:'uuid'}) taskId: string;
  @Column({type:'uuid'}) studentId: string;
  @Column({type:'varchar'}) category: string;
  @Column({type:'text'}) details: string;
  @Column({type:'jsonb',default:{}}) taskSnapshot: Record<string,string|number|boolean>;
  @Column({type:'varchar',default:'open'}) state: string;
  @Column({type:'text',default:''}) resolution: string;
  @Column({type:'uuid',nullable:true}) resolvedBy: string | null;
  @Column({type:'timestamp',nullable:true}) resolvedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_application')
@Index(['taskId', 'studentId'], { unique: true })
export class CareerApplication {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) taskId: string;
  @Column({type: 'uuid'}) studentId: string;
  @Column({type: 'text'}) message: string;
  @Column({type: 'varchar', default: 'pending'}) state: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_work')
@Index(['taskId'], { unique: true })
export class CareerWork {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) taskId: string;
  @Column({type: 'uuid'}) studentId: string;
  @Column({type: 'varchar', default: 'in_progress'}) state: string;
  @Column({type: 'text', default: ''}) submission: string;
  @Column({type: 'text', default: ''}) resultUrl: string;
  @Column({type: 'text', default: ''}) decisionReason: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_review')
@Index(['workId'], { unique: true })
export class CareerReview {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) workId: string;
  @Column({type: 'uuid'}) authorId: string;
  @Column({type: 'integer'}) rating: number;
  @Column({type: 'text'}) body: string;
  @Column({type: 'boolean', default: false}) publishAllowed: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_portfolio')
@Index(['workId'], { unique: true })
export class CareerPortfolio {
  @Column({type: 'text', default: ''}) caseText: string;
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) workId: string;
  @Column({type: 'uuid'}) studentId: string;
  @Column({type: 'boolean', default: false}) published: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_test')
@Index(['universityId','skill'], {unique:true})
export class CareerTest {
  @PrimaryGeneratedColumn('uuid') id:string;
  @Column({type:'uuid'}) universityId:string;
  @Column() skill:string;
  @Column() title:string;
  @Column({type:'integer',default:70}) passingPercent:number;
  @Column({type:'jsonb'}) questions:Array<{prompt:string;options:string[];answer:number}>;
  @CreateDateColumn() createdAt:Date;
  @UpdateDateColumn() updatedAt:Date;
}
@Entity('career_test_attempt')
export class CareerTestAttempt {
  @PrimaryGeneratedColumn('uuid') id:string;
  @Column({type:'uuid'}) testId:string;
  @Column({type:'uuid'}) studentId:string;
  @Column({type:'integer'}) score:number;
  @Column({type:'boolean'}) passed:boolean;
  @CreateDateColumn() createdAt:Date;
  @UpdateDateColumn() updatedAt:Date;
}

@Entity('career_notice')
@Index(['userId','createdAt'])
export class CareerNotice {
  @PrimaryGeneratedColumn('uuid') id:string;
  @Column({type:'uuid'}) userId:string;
  @Column() title:string;
  @Column({type:'text'}) body:string;
  @Column({type:'boolean',default:false}) isRead:boolean;
  @CreateDateColumn() createdAt:Date;
  @UpdateDateColumn() updatedAt:Date;
}

@Entity('career_ai_request')
@Index(['userId', 'createdAt'])
export class CareerAiRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({type: 'uuid'}) userId: string;
  @Column() kind: string;
  @Column({default: 'started'}) state: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity('career_availability')
export class CareerAvailability {
  @PrimaryColumn({type:'uuid'}) studentId:string;
  @Column({type:'uuid'}) universityId:string;
  @Column({type:'integer'}) weeklyHours:number;
  @Column() timeZone:string;
  @Column({type:'jsonb'}) windows:Array<{day:number;start:string;end:string}>;
  @Column({type:'jsonb',default:[]}) blockedDates:Array<{start:string;end:string}>;
  @UpdateDateColumn() updatedAt:Date;
}
