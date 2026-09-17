import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { ChangeDetectorService } from './change-detector.service';
import { ExcelConnectorService } from './connectors/excel-connector.service';
import { SibitConnectorService } from './connectors/sibit-connector.service';
import { RaspModule } from '../rasp/rasp.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lesson, LessonChange]), HttpModule, RaspModule],
  providers: [
    ScheduleService,
    ChangeDetectorService,
    ExcelConnectorService,
    SibitConnectorService,
  ],
  controllers: [ScheduleController],
  exports: [ScheduleService],
})
export class ScheduleModule {}
