import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { DiscussionMessage } from '../pair-space/entities/discussion-message.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformModule } from '../platform/platform.module';
import { PlatformDiscussionsController } from './platform-discussions.controller';
import { PlatformDiscussionsService } from './platform-discussions.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, DiscussionMessage, PairSpace, Lesson, University, User]), PlatformModule],
  controllers: [PlatformDiscussionsController],
  providers: [PlatformDiscussionsService],
})
export class PlatformDiscussionsModule {}
