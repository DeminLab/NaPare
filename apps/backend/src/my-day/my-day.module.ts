import { Module } from '@nestjs/common';

import { MyDayService } from './my-day.service';
import { MyDayController } from './my-day.controller';
import { ScheduleModule } from '../schedule/schedule.module';
import { PairSpaceModule } from '../pair-space/pair-space.module';
import { AbsencesModule } from '../absences/absences.module';
import { CareerModule } from '../career/career.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ScheduleModule, PairSpaceModule, AbsencesModule, NotificationsModule, CareerModule],
  providers: [MyDayService],
  controllers: [MyDayController],
})
export class MyDayModule {}
