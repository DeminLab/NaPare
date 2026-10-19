import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { FileAttachment } from '../pair-space/entities/file-attachment.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformModule } from '../platform/platform.module';
import { PlatformAttachmentsController } from './platform-attachments.controller';
import { PlatformAttachmentsService } from './platform-attachments.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileAttachment, PairSpace, Lesson, Group, University, User, AuditLog]), PlatformModule],
  controllers: [PlatformAttachmentsController],
  providers: [PlatformAttachmentsService],
})
export class PlatformAttachmentsModule {}
