import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { LessonChange } from '../schedule/entities/lesson-change.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Announcement } from '../pair-space/entities/announcement.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { Absence } from '../absences/entities/absence.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';

const entities = [
  User,
  Lesson,
  LessonChange,
  PairSpace,
  Announcement,
  Homework,
  Absence,
  Notification,
  DeviceToken,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
