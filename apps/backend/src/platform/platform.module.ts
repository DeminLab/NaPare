import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformControl, PlatformGrant } from './platform.entity';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { PlatformService } from './platform.service';
import { ControlAgentClient } from './control-agent.client';
import { PlatformController, PlatformPublicController } from './platform.controller';
@Module({ imports: [TypeOrmModule.forFeature([PlatformControl, PlatformGrant, User, University, AuditLog])], controllers: [PlatformController, PlatformPublicController], providers: [PlatformService, ControlAgentClient], exports: [PlatformService] })
export class PlatformModule {}
