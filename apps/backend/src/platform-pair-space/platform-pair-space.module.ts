import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Announcement } from '../pair-space/entities/announcement.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { FileAttachment } from '../pair-space/entities/file-attachment.entity';
import { DiscussionMessage } from '../pair-space/entities/discussion-message.entity';
import { HomeworkSubmission } from '../pair-space/entities/homework-submission.entity';
import { HomeworkProgress } from '../pair-space/entities/homework-progress.entity';
import { PersonalLessonNote } from '../pair-space/entities/personal-lesson-note.entity';
import { Course } from '../academic/entities/course.entity';
import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { LessonSpace } from '../academic/entities/lesson-space.entity';
import { CourseSpace } from '../academic/entities/course-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformModule } from '../platform/platform.module';
import { PlatformPairSpaceController } from './platform-pair-space.controller';
import { PlatformPairSpaceService } from './platform-pair-space.service';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement, PairSpace, Homework, HomeworkSubmission, HomeworkProgress, PersonalLessonNote, FileAttachment, DiscussionMessage, Course, LessonOccurrence, LessonSpace, CourseSpace, Lesson, Group, University, User, AuditLog]), PlatformModule],
  controllers: [PlatformPairSpaceController],
  providers: [PlatformPairSpaceService],
})
export class PlatformPairSpaceModule {}
