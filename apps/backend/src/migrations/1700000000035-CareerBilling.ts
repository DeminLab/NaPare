import { MigrationInterface, QueryRunner } from 'typeorm';

export class CareerBilling1700000000035 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE career_payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "companyId" uuid NOT NULL REFERENCES career_company(id),
        "createdBy" uuid NOT NULL, "idempotencyKey" uuid NOT NULL, product varchar NOT NULL,
        "receiptEmail" varchar NOT NULL, "amountMinor" integer NOT NULL CHECK ("amountMinor" > 0),
        currency varchar NOT NULL DEFAULT 'RUB' CHECK(currency = 'RUB'), state varchar NOT NULL DEFAULT 'created',
        "providerPaymentId" varchar UNIQUE, "confirmationUrl" varchar, "refundedMinor" integer NOT NULL DEFAULT 0,
        "checkedAt" timestamptz, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("companyId", "idempotencyKey"), CHECK ("refundedMinor" >= 0 AND "refundedMinor" <= "amountMinor")
      );
      CREATE TABLE career_payment_refunds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "paymentId" uuid NOT NULL REFERENCES career_payments(id),
        "actorId" uuid NOT NULL, "idempotencyKey" uuid NOT NULL, "amountMinor" integer NOT NULL CHECK ("amountMinor" > 0),
        state varchar NOT NULL DEFAULT 'pending', reason varchar(500) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
        UNIQUE ("paymentId", "idempotencyKey")
      );
      CREATE TABLE career_payment_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "paymentId" uuid NOT NULL REFERENCES career_payments(id),
        "eventKey" varchar NOT NULL UNIQUE, source varchar NOT NULL, "providerStatus" varchar NOT NULL,
        state varchar NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE career_payment_events; DROP TABLE career_payment_refunds; DROP TABLE career_payments');
  }
}
