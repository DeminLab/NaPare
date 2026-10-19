import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { HomeworkSubmission } from '../pair-space/entities/homework-submission.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformModule } from '../platform/platform.module';
import { PlatformHomeworkController } from './platform-homework.controller';
import { PlatformHomeworkService } from './platform-homework.service';

@Module({
  imports: [TypeOrmModule.forFeature([HomeworkSubmission, Homework, PairSpace, Lesson, University, User, AuditLog]), PlatformModule],
  controllers: [PlatformHomeworkController],
  providers: [PlatformHomeworkService],
  exports: [PlatformHomeworkService],
})
export class PlatformHomeworkModule {}
