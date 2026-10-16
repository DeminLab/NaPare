import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { SuperadminController } from "./superadmin.controller";
import { SuperadminService } from "./superadmin.service";
import { UsersModule } from "../users/users.module";
import { ScheduleModule } from "../schedule/schedule.module";
import { University } from "../users/entities/university.entity";
import { Faculty } from "../users/entities/faculty.entity";
import { Group } from "../users/entities/group.entity";
import { AuditLog } from "../common/entities/audit-log.entity";
import { EventsModule } from "../events/events.module";
import { Lesson } from "../schedule/entities/lesson.entity";
import { User } from "../users/entities/user.entity";
import { MoodleModule } from "../moodle/moodle.module";
import { CurationModule } from "../curation/curation.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      University,
      Faculty,
      Group,
      AuditLog,
      Lesson,
      User,
    ]),
    UsersModule,
    ScheduleModule,
    EventsModule,
    MoodleModule,
    CurationModule,
  ],
  providers: [AdminService, SuperadminService],
  controllers: [AdminController, SuperadminController],
})
export class AdminModule {}
