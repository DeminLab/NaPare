import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DevicesController } from './devices.controller';
import { NotificationEventHandler } from './events/notification-event.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, DeviceToken]),
    EventEmitterModule,
  ],
  providers: [NotificationsService, NotificationEventHandler],
  controllers: [NotificationsController, DevicesController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
