import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventsModule } from '../events/events.module';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { Course } from './entities/course.entity';
import { LessonSeries } from './entities/lesson-series.entity';
import { LessonOccurrence } from './entities/lesson-occurrence.entity';
import { AcademicEvent } from './entities/academic-event.entity';
import { CourseSpace } from './entities/course-space.entity';
import { LessonSpace } from './entities/lesson-space.entity';
import { ScheduleChange } from './entities/schedule-change.entity';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      LessonSeries,
      LessonOccurrence,
      AcademicEvent,
      CourseSpace,
      LessonSpace,
      ScheduleChange,
      Group,
      Faculty,
    ]),
    EventsModule,
  ],
  providers: [AcademicService],
  controllers: [AcademicController],
  exports: [AcademicService],
})
export class AcademicModule {}
