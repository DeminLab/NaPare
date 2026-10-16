import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Absence } from "./entities/absence.entity";
import { AbsenceConfirmation } from "./entities/absence-confirmation.entity";
import { AttendanceRecord } from "./entities/attendance-record.entity";
import { AttendanceQrSession } from "./entities/attendance-qr-session.entity";
import { Lesson } from "../schedule/entities/lesson.entity";
import { User } from "../users/entities/user.entity";
import { Group } from "../users/entities/group.entity";
import { AbsencesService } from "./absences.service";
import { AbsencesController } from "./absences.controller";
import { CuratorController } from "./curator.controller";
import { EventsModule } from "../events/events.module";
import { CurationModule } from "../curation/curation.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Absence,
      AbsenceConfirmation,
      AttendanceRecord,
      AttendanceQrSession,
      Lesson,
      User,
      Group,
    ]),
    EventsModule,
    CurationModule,
  ],
  providers: [AbsencesService],
  controllers: [AbsencesController, CuratorController],
  exports: [AbsencesService],
})
export class AbsencesModule {}
