import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('office_debt_snapshots')
@Index('UQ_office_debt_import', ['organizationId', 'requestId'], { unique: true })
@Index('UQ_office_debt_current_group', ['organizationId', 'groupId'], { unique: true, where: '"supersededAt" IS NULL' })
export class OfficeDebtSnapshot {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @Column('uuid') groupId: string;
  @Column('uuid') requestId: string;
  @Column('varchar') digest: string;
  @Column('varchar') source: string;
  @Column('varchar') reference: string;
  @Column('date') asOfDate: string;
  @Column('uuid') verifiedBy: string;
  @CreateDateColumn() createdAt: Date;
  @Column('timestamp', { nullable: true }) supersededAt: Date | null;
}

@Entity('office_debt_records')
@Index('IDX_office_debt_student', ['organizationId', 'studentId'])
export class OfficeDebtRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') organizationId: string;
  @Column('uuid') groupId: string;
  @Column('uuid') snapshotId: string;
  @Column('uuid') studentId: string;
  @Column('varchar') subject: string;
  @Column('varchar') period: string;
  @Column('varchar') basis: string;
}

export const OFFICE_REPORT_ENTITIES = [OfficeDebtSnapshot, OfficeDebtRecord];
