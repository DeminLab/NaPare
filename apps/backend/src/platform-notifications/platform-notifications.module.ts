import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { InboxItem } from '../notifications/entities/inbox-item.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { PlatformModule } from '../platform/platform.module';
import { PlatformNotificationsController } from './platform-notifications.controller';
import { PlatformNotificationsService } from './platform-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, InboxItem, DeviceToken, User, University, AuditLog]), PlatformModule],
  controllers: [PlatformNotificationsController],
  providers: [PlatformNotificationsService],
})
export class PlatformNotificationsModule {}
