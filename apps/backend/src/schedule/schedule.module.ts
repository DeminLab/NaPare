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
import { RaspModule } from "../rasp/rasp.module";
import { EventsModule } from "../events/events.module";
import { LessonOccurrence } from "../academic/entities/lesson-occurrence.entity";
import { ScheduleChange } from "../academic/entities/schedule-change.entity";
import { Group } from "../users/entities/group.entity";
import { CurationModule } from "../curation/curation.module";
import { LessonIdentifierService } from "../common/identifiers/lesson-identifier.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      LessonChange,
      AcademicTerm,
      CalendarException,
      LessonOccurrence,
      ScheduleChange,
      Group,
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
  ],
  controllers: [ScheduleController],
  exports: [ScheduleService, SibitConnectorService, LessonIdentifierService],
})
export class ScheduleModule {}
