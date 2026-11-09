import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthEvent, PlatformEvent, UserSession } from './telemetry.entities';
import { TelemetryController } from './telemetry.controller';
import { TelemetryInterceptor } from './telemetry.interceptor';
import { TelemetryService } from './telemetry.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UserSession, AuthEvent, PlatformEvent])],
  controllers: [TelemetryController],
  providers: [
    TelemetryService,
    OptionalJwtAuthGuard,
    { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
  ],
  exports: [TelemetryService],
})
export class TelemetryModule {}
