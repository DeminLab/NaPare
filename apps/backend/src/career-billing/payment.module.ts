import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PlatformModule } from '../platform/platform.module';
import { CareerMembership } from '../career/career.entities';
import { CareerPayment, CareerPaymentRefund, CareerPaymentEvent } from './payment.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TkassaProvider } from './tkassa.provider';

@Module({
  imports: [AuthModule, PlatformModule, TypeOrmModule.forFeature([CareerMembership, CareerPayment, CareerPaymentRefund, CareerPaymentEvent])],
  controllers: [PaymentController], providers: [PaymentService, TkassaProvider],
})
export class PaymentModule {}
