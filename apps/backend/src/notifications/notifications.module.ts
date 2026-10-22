import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DevicesController } from './devices.controller';
import { NotificationEventHandler } from './events/notification-event.handler';
import { NotificationPreference } from './entities/notification-preference.entity';
import { InboxItem } from './entities/inbox-item.entity';
import { User } from '../users/entities/user.entity';
import { Homework } from '../pair-space/entities/homework.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { EventsModule } from '../events/events.module';
import { HomeworkDeadlineReminderService } from './homework-deadline-reminder.service';
import { HomeworkProgress } from '../pair-space/entities/homework-progress.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationDeliveryService } from './delivery/notification-delivery.service';
import { NotificationProviders } from './delivery/push-providers';
import { HEALTH_QUEUE_PROBE } from '../health.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification, DeviceToken, NotificationPreference, InboxItem, User,
      Homework, HomeworkProgress, PairSpace, Lesson,
      NotificationDelivery,
    ]),
    EventEmitterModule,
    EventsModule,
  ],
  providers: [NotificationsService, NotificationEventHandler, HomeworkDeadlineReminderService,
    NotificationDeliveryService, NotificationProviders,
    { provide: HEALTH_QUEUE_PROBE, useExisting: NotificationDeliveryService }],
  controllers: [NotificationsController, DevicesController],
  exports: [NotificationsService, HEALTH_QUEUE_PROBE],
})
export class NotificationsModule {}
