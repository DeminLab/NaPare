import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { PairSpace } from "./entities/pair-space.entity";
import { Announcement } from "./entities/announcement.entity";
import { Homework } from "./entities/homework.entity";
import { FileAttachment } from "./entities/file-attachment.entity";
import { DiscussionMessage } from "./entities/discussion-message.entity";
import { PersonalLessonNote } from "./entities/personal-lesson-note.entity";
import { HomeworkProgress } from "./entities/homework-progress.entity";
import { HomeworkSubmission } from "./entities/homework-submission.entity";
import { PairSpaceService } from "./pair-space.service";
import { PairSpaceController } from "./pair-space.controller";
import { EventsModule } from "../events/events.module";
import { Lesson } from "../schedule/entities/lesson.entity";
import { Group } from "../users/entities/group.entity";
import { University } from "../users/entities/university.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PairSpace,
      Announcement,
      Homework,
      FileAttachment,
      DiscussionMessage,
      PersonalLessonNote,
      HomeworkProgress,
      HomeworkSubmission,
      Lesson,
      Group,
      University,
    ]),
    EventsModule,
  ],
  providers: [PairSpaceService],
  controllers: [PairSpaceController],
  exports: [PairSpaceService],
})
export class PairSpaceModule {}
