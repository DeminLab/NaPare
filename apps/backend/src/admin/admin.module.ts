import { Module } from '@nestjs/common';

import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
  imports: [UsersModule, ScheduleModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
