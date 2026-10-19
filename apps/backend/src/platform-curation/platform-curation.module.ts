import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformModule } from '../platform/platform.module';
import { PlatformCurationController } from './platform-curation.controller';
import { PlatformCurationService } from './platform-curation.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, CuratorAssignment, Group, University, User]), PlatformModule],
  controllers: [PlatformCurationController],
  providers: [PlatformCurationService],
})
export class PlatformCurationModule {}
