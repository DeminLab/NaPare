import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { EventsModule } from '../events/events.module';
import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { LessonSeries } from '../academic/entities/lesson-series.entity';
import { Course } from '../academic/entities/course.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { ScheduleChange } from '../academic/entities/schedule-change.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { LessonChange } from '../schedule/entities/lesson-change.entity';
import { AcademicEvent } from '../academic/entities/academic-event.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { PlatformAcademicController } from './platform-academic.controller';
import { PlatformAcademicService } from './platform-academic.service';
import { PlatformAcademicLegacyController } from './platform-academic-legacy.controller';
import { PlatformAcademicLegacyService } from './platform-academic-legacy.service';
import { PlatformAcademicEventsController } from './platform-academic-events.controller';
import { PlatformAcademicEventsService } from './platform-academic-events.service';
import { PlatformAcademicCatalogController } from './platform-academic-catalog.controller';
import { PlatformAcademicCatalogService } from './platform-academic-catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([LessonOccurrence, LessonSeries, Course, Group, University, User, ScheduleChange, Lesson, LessonChange, AcademicEvent, AuditLog]), PlatformModule, EventsModule],
  controllers: [PlatformAcademicController, PlatformAcademicLegacyController, PlatformAcademicEventsController, PlatformAcademicCatalogController],
  providers: [PlatformAcademicService, PlatformAcademicLegacyService, PlatformAcademicEventsService, PlatformAcademicCatalogService],
})
export class PlatformAcademicModule {}
