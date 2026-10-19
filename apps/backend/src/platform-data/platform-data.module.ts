import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Absence } from '../absences/entities/absence.entity';
import { AttendanceRecord } from '../absences/entities/attendance-record.entity';
import { AbsenceConfirmation } from '../absences/entities/absence-confirmation.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformModule } from '../platform/platform.module';
import { PlatformDataController } from './platform-data.controller';
import { PlatformDataService } from './platform-data.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Absence, AttendanceRecord, AbsenceConfirmation, AuditLog, Lesson, University, User]),
    PlatformModule,
  ],
  controllers: [PlatformDataController],
  providers: [PlatformDataService],
  exports: [PlatformDataService],
})
export class PlatformDataModule {}
