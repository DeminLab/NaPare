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

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, DeviceToken, NotificationPreference, InboxItem, User]),
    EventEmitterModule,
  ],
  providers: [NotificationsService, NotificationEventHandler],
  controllers: [NotificationsController, DevicesController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
