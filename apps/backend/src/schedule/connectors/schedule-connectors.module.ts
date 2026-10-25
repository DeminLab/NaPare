import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoodleModule } from '../../moodle/moodle.module';
import { RaspModule } from '../../rasp/rasp.module';
import { University } from '../../users/entities/university.entity';
import { Group } from '../../users/entities/group.entity';
import { User } from '../../users/entities/user.entity';
import { ScheduleChange } from '../../academic/entities/schedule-change.entity';
import { Lesson } from '../entities/lesson.entity';
import { CsvScheduleConnector, IcsScheduleConnector, XlsxScheduleConnector } from './file-schedule-connectors';
import { MoodleScheduleConnector, SibitScheduleConnector } from './external-schedule-connectors';
import { ScheduleImportJob } from './schedule-import-job.entity';
import { ScheduleImportService } from './schedule-import.service';

@Module({
  imports: [TypeOrmModule.forFeature([University, Group, User, Lesson, ScheduleChange, ScheduleImportJob]), MoodleModule, RaspModule],
  providers: [CsvScheduleConnector, IcsScheduleConnector, XlsxScheduleConnector, SibitScheduleConnector, MoodleScheduleConnector, ScheduleImportService],
  exports: [ScheduleImportService],
})
export class ScheduleConnectorsModule {}
