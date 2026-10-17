import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { Group } from '../users/entities/group.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { PersonalLessonNote } from '../pair-space/entities/personal-lesson-note.entity';
import { HomeworkProgress } from '../pair-space/entities/homework-progress.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import { PlatformRecordsController } from './platform-records.controller';
import { PlatformRecordsService } from './platform-records.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, University, Group, AuditLog, NotificationPreference, Favorite,
      PersonalLessonNote, HomeworkProgress, PairSpace, Homework, Lesson, CuratorAssignment,
    ]),
    PlatformModule,
  ],
  controllers: [PlatformRecordsController],
  providers: [PlatformRecordsService],
  exports: [PlatformRecordsService],
})
export class PlatformRecordsModule {}
