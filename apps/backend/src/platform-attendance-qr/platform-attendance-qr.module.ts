import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { AttendanceQrSession } from '../absences/entities/attendance-qr-session.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformModule } from '../platform/platform.module';
import { PlatformAttendanceQrController } from './platform-attendance-qr.controller';
import { PlatformAttendanceQrService } from './platform-attendance-qr.service';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceQrSession, AuditLog, Group, Lesson, University, User]), PlatformModule],
  controllers: [PlatformAttendanceQrController],
  providers: [PlatformAttendanceQrService],
})
export class PlatformAttendanceQrModule {}
