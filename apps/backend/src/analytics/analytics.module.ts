import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductActivityDay, ProductAnalyticsState } from './analytics.entities';
import { ProductAnalyticsController } from './analytics.controller';
import { ProductAnalyticsService } from './analytics.service';
import { ProductAnalyticsInterceptor } from './analytics.interceptor';

@Module({imports:[TypeOrmModule.forFeature([ProductActivityDay,ProductAnalyticsState])],controllers:[ProductAnalyticsController],providers:[ProductAnalyticsService,{provide:APP_INTERCEPTOR,useClass:ProductAnalyticsInterceptor}],exports:[ProductAnalyticsService]})
export class ProductAnalyticsModule {}
