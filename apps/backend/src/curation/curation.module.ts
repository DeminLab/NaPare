import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuratorAssignment } from './entities/curator-assignment.entity';
import { Group } from '../users/entities/group.entity';
import { User } from '../users/entities/user.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { Absence } from '../absences/entities/absence.entity';
import { AbsenceConfirmation } from '../absences/entities/absence-confirmation.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { CurationService } from './curation.service';
import { CurationController } from './curation.controller';

@Module({ imports: [TypeOrmModule.forFeature([CuratorAssignment, Group, User, Lesson, Absence, AbsenceConfirmation, AuditLog])], providers: [CurationService], controllers: [CurationController], exports: [CurationService] })
export class CurationModule {}
