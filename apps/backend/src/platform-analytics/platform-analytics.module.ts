import { Module } from '@nestjs/common';

import { PlatformModule } from '../platform/platform.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { PlatformAnalyticsController } from './platform-analytics.controller';
import { PlatformAnalyticsService } from './platform-analytics.service';

@Module({
  imports: [PlatformModule, TelemetryModule],
  controllers: [PlatformAnalyticsController],
  providers: [PlatformAnalyticsService],
})
export class PlatformAnalyticsModule {}
