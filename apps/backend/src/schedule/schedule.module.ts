import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";

import { Lesson } from "./entities/lesson.entity";
import { LessonChange } from "./entities/lesson-change.entity";
import { AcademicTerm } from "./entities/academic-term.entity";
import { CalendarException } from "./entities/calendar-exception.entity";
import { ScheduleService } from "./schedule.service";
import { AcademicCalendarService } from "./academic-calendar.service";
import { ScheduleController } from "./schedule.controller";
import { ChangeDetectorService } from "./change-detector.service";
import { SibitConnectorService } from "./connectors/sibit-connector.service";
import { ScheduleSeriesService } from "./schedule-series.service";
import { ScheduleReadService } from "./schedule-read.service";
import { RaspModule } from "../rasp/rasp.module";
import { EventsModule } from "../events/events.module";
import { LessonOccurrence } from "../academic/entities/lesson-occurrence.entity";
import { LessonSeries } from "../academic/entities/lesson-series.entity";
import { ScheduleChange } from "../academic/entities/schedule-change.entity";
import { Group } from "../users/entities/group.entity";
import { User } from "../users/entities/user.entity";
import { Faculty } from "../users/entities/faculty.entity";
import { University } from "../users/entities/university.entity";
import { CurationModule } from "../curation/curation.module";
import { LessonIdentifierService } from "../common/identifiers/lesson-identifier.service";
import { PublicScheduleController } from "./public-schedule.controller";
import { PublicScheduleService } from "./public-schedule.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      LessonChange,
      AcademicTerm,
      CalendarException,
      LessonOccurrence,
      LessonSeries,
      ScheduleChange,
      Group,
      User,
      Faculty,
      University,
    ]),
    HttpModule,
    RaspModule,
    EventsModule,
    CurationModule,
  ],
  providers: [
    ScheduleService,
    AcademicCalendarService,
    ChangeDetectorService,
    SibitConnectorService,
    LessonIdentifierService,
    ScheduleSeriesService,
    ScheduleReadService,
    PublicScheduleService,
  ],
  controllers: [ScheduleController, PublicScheduleController],
  exports: [ScheduleService, SibitConnectorService, LessonIdentifierService],
})
export class ScheduleModule {}
