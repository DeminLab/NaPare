import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { University } from '../users/entities/university.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { Teacher } from '../users/entities/teacher.entity';
import { User } from '../users/entities/user.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { LessonChange } from '../schedule/entities/lesson-change.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Announcement } from '../pair-space/entities/announcement.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { HomeworkSubmission } from '../pair-space/entities/homework-submission.entity';
import { FileAttachment } from '../pair-space/entities/file-attachment.entity';
import { DiscussionMessage } from '../pair-space/entities/discussion-message.entity';
import { Absence } from '../absences/entities/absence.entity';
import { AbsenceConfirmation } from '../absences/entities/absence-confirmation.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { EventRecord } from '../events/entities/event-record.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { InboxItem } from '../notifications/entities/inbox-item.entity';
import { Course } from '../academic/entities/course.entity';
import { LessonSeries } from '../academic/entities/lesson-series.entity';
import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { AcademicEvent } from '../academic/entities/academic-event.entity';
import { CourseSpace } from '../academic/entities/course-space.entity';
import { LessonSpace } from '../academic/entities/lesson-space.entity';
import { ScheduleChange } from '../academic/entities/schedule-change.entity';

const entities = [
  University,
  Faculty,
  Group,
  Teacher,
  User,
  Lesson,
  LessonChange,
  PairSpace,
  Announcement,
  Homework,
  HomeworkSubmission,
  FileAttachment,
  DiscussionMessage,
  Absence,
  AbsenceConfirmation,
  Notification,
  DeviceToken,
  AuditLog,
  EventRecord,
  NotificationPreference,
  InboxItem,
  Course,
  LessonSeries,
  LessonOccurrence,
  AcademicEvent,
  CourseSpace,
  LessonSpace,
  ScheduleChange,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
