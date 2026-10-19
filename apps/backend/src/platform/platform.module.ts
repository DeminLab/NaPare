import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformControl, PlatformGrant } from './platform.entity';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { Group } from '../users/entities/group.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { CuratorAssignment } from '../curation/entities/curator-assignment.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { PlatformService } from './platform.service';
import { ControlAgentClient } from './control-agent.client';
import { PlatformController, PlatformPublicController } from './platform.controller';
import { RaspModule } from '../rasp/rasp.module';
@Module({ imports: [TypeOrmModule.forFeature([PlatformControl, PlatformGrant, User, University, Faculty, Group, CuratorAssignment, AuditLog]), RaspModule], controllers: [PlatformController, PlatformPublicController], providers: [PlatformService, ControlAgentClient], exports: [PlatformService] })
export class PlatformModule {}
