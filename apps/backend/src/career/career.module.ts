import { CareerPlanningService } from './career-planning.service';
import { ScheduleModule } from '../schedule/schedule.module';
import { CareerAiService } from './career-ai.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './career.entities';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { AuthModule } from '../auth/auth.module';
import { CareerService } from './career.service';
import { CareerReportService } from './career-report.service';
import { CareerReportController } from './career-report.controller';
import { CareerController, CareerAccountsController } from './career.controller';

@Module({ imports: [TypeOrmModule.forFeature([...Object.values(entities), User, University ]), AuthModule, ScheduleModule], providers: [CareerService, CareerAiService, CareerPlanningService, CareerReportService], controllers: [CareerController, CareerAccountsController, CareerReportController] })
export class CareerModule {}
