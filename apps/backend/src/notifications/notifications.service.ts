import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './entities/notification.entity';
import { DevicePlatform, DeviceToken } from './entities/device-token.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { TenantContext } from '../common/tenant/tenant-context';
import { UserRole } from '../auth/interfaces/user-role';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from '../common/dto/pagination-query.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    private readonly tenantContext: TenantContext,
  ) {}

  async findByUser(
    userId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Notification>> {
    const currentUser = this.tenantContext.getUser();
    const [data, total] = await this.notificationRepository.findAndCount({
      where: currentUser && currentUser.role !== UserRole.SUPERADMIN
        ? { userId, universityId: currentUser.universityId }
        : { userId },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const currentUser = this.tenantContext.getUser();
    return this.notificationRepository.count({
      where: currentUser && currentUser.role !== UserRole.SUPERADMIN
        ? { userId, universityId: currentUser.universityId, isRead: false }
        : { userId, isRead: false },
    });
  }

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    this.tenantContext.assertAccess(createNotificationDto.universityId);
    const notification = this.notificationRepository.create(createNotificationDto);
    return this.notificationRepository.save(notification);
  }

  async markAsRead(id: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification) {
      throw new NotFoundException(`Notification with id ${id} not found`);
    }
    this.tenantContext.assertAccess(notification.universityId);
    await this.notificationRepository.update(notification.id, {
      isRead: true,
      readAt: new Date(),
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const currentUser = this.tenantContext.getUser();
    await this.notificationRepository.update(
      currentUser && currentUser.role !== UserRole.SUPERADMIN
        ? { userId, universityId: currentUser.universityId, isRead: false }
        : { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: DevicePlatform,
    deviceName?: string,
  ): Promise<DeviceToken> {
    const currentUser = this.tenantContext?.getUser();
    if (currentUser && currentUser.id !== userId) {
      throw new ForbiddenException('Cannot register a device token for another user');
    }
    // Check if token already exists
    const existingToken = await this.deviceTokenRepository.findOne({
      where: { token },
    });

    if (existingToken) {
      const currentUser = this.tenantContext.getUser();
      if (currentUser && existingToken.userId !== userId) {
        throw new ForbiddenException('Device token belongs to another user');
      }
      existingToken.userId = userId;
      existingToken.platform = platform;
      existingToken.deviceName = deviceName;
      existingToken.isActive = true;
      return this.deviceTokenRepository.save(existingToken);
    }

    const deviceToken = this.deviceTokenRepository.create({
      userId,
      token,
      platform,
      deviceName,
    });

    return this.deviceTokenRepository.save(deviceToken);
  }

  async removeDeviceToken(token: string): Promise<void> {
    const existingToken = await this.deviceTokenRepository.findOne({ where: { token } });
    if (!existingToken) return;
    const currentUser = this.tenantContext.getUser();
    if (currentUser && existingToken.userId !== currentUser.id) {
      throw new ForbiddenException('Device token belongs to another user');
    }
    await this.deviceTokenRepository.delete({ token });
  }

  async getDeviceTokens(userId: string): Promise<DeviceToken[]> {
    const currentUser = this.tenantContext?.getUser();
    if (currentUser && currentUser.id !== userId) {
      throw new ForbiddenException('Cannot read device tokens for another user');
    }
    return this.deviceTokenRepository.find({
      where: { userId, isActive: true },
    });
  }
}
