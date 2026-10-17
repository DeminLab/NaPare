import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { PlatformModule } from '../platform/platform.module';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { CareerAdmission, CareerProfile } from '../career/career.entities';
import { CareerApplication, CareerCompany, CareerNotice, CareerTask, CareerWork } from '../career/career.entities';
import { PlatformCareerOperationsController } from './platform-career-operations.controller';
import { PlatformCareerOperationsService } from './platform-career-operations.service';
import { PlatformCareerController } from './platform-career.controller';
import { PlatformCareerService } from './platform-career.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, CareerAdmission, CareerProfile, CareerApplication, CareerCompany, CareerNotice, CareerTask, CareerWork, University, User]), PlatformModule],
  controllers: [PlatformCareerController, PlatformCareerOperationsController],
  providers: [PlatformCareerService, PlatformCareerOperationsService],
})
export class PlatformCareerModule {}
