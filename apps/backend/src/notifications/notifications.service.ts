import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './entities/notification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(createNotificationDto);
    return this.notificationRepository.save(notification);
  }

  async markAsRead(id: string): Promise<void> {
    await this.notificationRepository.update(id, {
      isRead: true,
      readAt: new Date(),
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
    deviceName?: string,
  ): Promise<DeviceToken> {
    // Check if token already exists
    const existingToken = await this.deviceTokenRepository.findOne({
      where: { token },
    });

    if (existingToken) {
      existingToken.userId = userId;
      existingToken.platform = platform as any;
      existingToken.deviceName = deviceName;
      existingToken.isActive = true;
      return this.deviceTokenRepository.save(existingToken);
    }

    const deviceToken = this.deviceTokenRepository.create({
      userId,
      token,
      platform: platform as any,
      deviceName,
    });

    return this.deviceTokenRepository.save(deviceToken);
  }

  async removeDeviceToken(token: string): Promise<void> {
    await this.deviceTokenRepository.delete({ token });
  }

  async getDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: { userId, isActive: true },
    });
  }
}
