import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PaymentState } from './payment-state';

@Entity('career_payments')
@Index(['companyId', 'idempotencyKey'], { unique: true })
export class CareerPayment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') companyId: string;
  @Column('uuid') createdBy: string;
  @Column('uuid') idempotencyKey: string;
  @Column('varchar') product: string;
  @Column('varchar', { select: false }) receiptEmail: string;
  @Column('integer') amountMinor: number;
  @Column('varchar', { default: 'RUB' }) currency: string;
  @Column('varchar', { default: 'created' }) state: PaymentState;
  @Column('varchar', { nullable: true, unique: true }) providerPaymentId: string | null;
  @Column('varchar', { nullable: true }) confirmationUrl: string | null;
  @Column('integer', { default: 0 }) refundedMinor: number;
  @Column('timestamptz', { nullable: true }) checkedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_payment_refunds')
@Index(['paymentId', 'idempotencyKey'], { unique: true })
export class CareerPaymentRefund {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') paymentId: string;
  @Column('uuid') actorId: string;
  @Column('uuid') idempotencyKey: string;
  @Column('integer') amountMinor: number;
  @Column('varchar', { default: 'pending' }) state: 'pending' | 'succeeded' | 'unknown' | 'failed';
  @Column('varchar', { length: 500 }) reason: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('career_payment_events')
export class CareerPaymentEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') paymentId: string;
  @Column('varchar', { unique: true }) eventKey: string;
  @Column('varchar') source: string;
  @Column('varchar') providerStatus: string;
  @Column('varchar') state: PaymentState;
  @CreateDateColumn() createdAt: Date;
}
