import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { EventRecord } from '../events/entities/event-record.entity';
import { PlatformModule } from '../platform/platform.module';
import { University } from '../users/entities/university.entity';
import { PlatformEventsController } from './platform-events.controller';
import { PlatformEventsService } from './platform-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventRecord, University, AuditLog]), PlatformModule],
  controllers: [PlatformEventsController],
  providers: [PlatformEventsService],
})
export class PlatformEventsModule {}
