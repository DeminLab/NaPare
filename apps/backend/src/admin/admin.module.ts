import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';
import { UsersModule } from '../users/users.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { University } from '../users/entities/university.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([University, Faculty, Group]),
    UsersModule,
    ScheduleModule,
  ],
  providers: [AdminService, SuperadminService],
  controllers: [AdminController, SuperadminController],
})
export class AdminModule {}
