import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification, NotificationAction } from './entities/notification.entity';
import { DevicePlatform, DeviceToken } from './entities/device-token.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationPreference } from './entities/notification-preference.entity';
import { InboxItem, InboxItemStatus } from './entities/inbox-item.entity';
import { TenantContext } from '../common/tenant/tenant-context';
import { UserRole } from '../auth/interfaces/user-role';
import { EventEnvelope, NapareEventType } from '../events/event.types';
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
    @Optional() @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @Optional() @InjectRepository(InboxItem)
    private readonly inboxRepository: Repository<InboxItem>,
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

  async processEvent(event: EventEnvelope, recipientIds: string[]): Promise<void> {
    const mapped = mapEvent(event);
    for (const userId of recipientIds) {
      const preference = await this.getPreferences(userId, event.university.id);
      if (!this.isAllowed(event.type, event.priority, preference)) continue;

      const existingNotification = await this.notificationRepository.findOne({
        where: { eventId: event.id, userId },
      });
      const notification = existingNotification ?? await this.notificationRepository.save(this.notificationRepository.create({
          userId,
          universityId: event.university.id,
          type: mapped.type,
          category: mapped.category,
          priority: event.priority,
          title: mapped.title,
          body: mapped.body,
          deepLink: mapped.deepLink,
          actions: mapped.actions,
          eventId: event.id,
          data: event.payload,
        }));

      if (mapped.inbox) {
        const existingInboxItem = await this.inboxRepository.findOne({
          where: { eventId: event.id, userId, type: event.type },
        });
        if (!existingInboxItem) {
          await this.inboxRepository.save(this.inboxRepository.create({
            eventId: event.id,
            userId,
            universityId: event.university.id,
            type: event.type,
            title: mapped.inbox.title,
            description: mapped.inbox.description,
            deepLink: mapped.deepLink,
            priority: event.priority,
            status: 'open',
            dueAt: mapped.dueAt,
            actions: mapped.actions,
            data: event.payload,
          }));
        }
      }

      this.logger.debug(`Created notification ${notification.id} for event ${event.id}`);
    }
  }

  async getPreferences(userId: string, universityId: string): Promise<NotificationPreference> {
    const existing = await this.preferenceRepository.findOne({ where: { userId, universityId } });
    if (existing) return existing;
    return this.preferenceRepository.save(this.preferenceRepository.create({ userId, universityId }));
  }

  async updatePreferences(
    userId: string,
    universityId: string,
    update: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreference> {
    this.tenantContext.assertAccess(universityId);
    const preferences = await this.getPreferences(userId, universityId);
    Object.assign(preferences, update);
    return this.preferenceRepository.save(preferences);
  }

  async findInbox(userId: string, status?: InboxItemStatus, limit = 50): Promise<InboxItem[]> {
    const currentUser = this.tenantContext.getUser();
    return this.inboxRepository.find({
      where: {
        userId,
        ...(status ? { status } : {}),
        ...(currentUser && currentUser.role !== UserRole.SUPERADMIN
          ? { universityId: currentUser.universityId }
          : {}),
      },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async completeInboxItem(userId: string, id: string): Promise<void> {
    const item = await this.inboxRepository.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException(`Inbox item with id ${id} not found`);
    this.tenantContext.assertAccess(item.universityId);
    await this.inboxRepository.update(item.id, { status: 'done', completedAt: new Date() });
  }

  async snoozeInboxItem(userId: string, id: string, until: Date): Promise<void> {
    const item = await this.inboxRepository.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException(`Inbox item with id ${id} not found`);
    this.tenantContext.assertAccess(item.universityId);
    await this.inboxRepository.update(item.id, { status: 'snoozed', dueAt: until });
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

  private isAllowed(
    type: NapareEventType,
    priority: EventEnvelope['priority'],
    preferences: NotificationPreference,
  ): boolean {
    if (priority === 'urgent') return true;
    const preferenceKey: keyof NotificationPreference | null = ({
      'lesson.changed': 'scheduleChanges',
      'lesson.rescheduled': 'scheduleChanges',
      'lesson.cancelled': 'cancellations',
      'room.changed': 'roomChanges',
      'homework.created': 'homeworkCreated',
      'homework.updated': 'homeworkCreated',
      'homework.deadline_soon': 'deadlines',
      'announcement.created': 'announcements',
      'message.created': 'messages',
      'sync.completed': 'systemAlerts',
      'sync.failed': 'systemAlerts',
      'absence.created': 'systemAlerts',
      'absence.updated': 'systemAlerts',
      'attendance.updated': 'systemAlerts',
      'grade.created': 'systemAlerts',
    } as Partial<Record<NapareEventType, keyof NotificationPreference>>)[type] ?? null;
    if (preferenceKey && preferences[preferenceKey] === false) return false;
    if (preferences.quietHoursEnabled && isQuietHours(preferences)) return false;
    return true;
  }
}

interface EventNotificationMapping {
  type: Notification['type'];
  category: Notification['category'];
  title: string;
  body: string;
  deepLink: string;
  actions: NotificationAction[];
  dueAt: Date | null;
  inbox: { title: string; description: string } | null;
}

function mapEvent(event: EventEnvelope): EventNotificationMapping {
  const payload = event.payload;
  const deepLink = typeof payload.deepLink === 'string'
    ? payload.deepLink
    : `/${event.target.type}/${event.target.id}`;
  const action: NotificationAction = { label: 'Открыть', href: deepLink };
  const mappings: Partial<Record<NapareEventType, Omit<EventNotificationMapping, 'deepLink' | 'actions' | 'dueAt'>>> = {
    'lesson.changed': { type: 'schedule_change', category: 'schedule', title: 'Изменение в расписании', body: 'В занятии изменились данные.', inbox: { title: 'Проверь изменения в расписании', description: 'Открой занятие и проверь новые детали.' } },
    'lesson.rescheduled': { type: 'schedule_change', category: 'schedule', title: 'Занятие перенесено', body: 'Время или дата занятия изменились.', inbox: { title: 'Проверь новое время занятия', description: 'Убедись, что новое время подходит твоему плану.' } },
    'lesson.cancelled': { type: 'schedule_change', category: 'important', title: 'Занятие отменено', body: 'Занятие больше не состоится по исходному плану.', inbox: { title: 'Обрати внимание на отмену', description: 'Проверь обновлённое расписание.' } },
    'room.changed': { type: 'schedule_change', category: 'schedule', title: 'Аудитория изменена', body: 'Для занятия назначена новая аудитория.', inbox: { title: 'Проверь новую аудиторию', description: 'Открой занятие и запланируй переход в новую аудиторию.' } },
    'homework.created': { type: 'new_homework', category: 'homework', title: 'Новое задание', body: 'В пространстве пары появилось новое задание.', inbox: { title: 'Выполни новое задание', description: 'Открой задание и проверь требования и дедлайн.' } },
    'homework.updated': { type: 'new_homework', category: 'homework', title: 'Задание обновлено', body: 'Изменились условия или статус задания.', inbox: { title: 'Проверь обновлённое задание', description: 'Открой задание и проверь изменения.' } },
    'homework.deadline_soon': { type: 'deadline', category: 'important', title: 'Скоро дедлайн', body: 'Срок сдачи задания приближается.', inbox: { title: 'Закрой задание до дедлайна', description: 'Проверь прогресс и отправь работу вовремя.' } },
    'announcement.created': { type: 'new_announcement', category: 'teachers', title: 'Новое объявление', body: 'Преподаватель опубликовал объявление.', inbox: null },
    'message.created': { type: 'other', category: 'teachers', title: 'Новое сообщение', body: 'В пространстве пары появилось сообщение.', inbox: { title: 'Ответь на сообщение', description: 'Открой обсуждение и посмотри новый контекст.' } },
    'absence.created': { type: 'new_absence', category: 'system', title: 'Новое отсутствие', body: 'Зарегистрировано отсутствие.', inbox: { title: 'Проверь отсутствие', description: 'Открой запись и проверь статус подтверждения.' } },
    'absence.updated': { type: 'absence_decision', category: 'system', title: 'Изменился статус отсутствия', body: 'Статус записи об отсутствии обновлён.', inbox: null },
    'attendance.updated': { type: 'other', category: 'system', title: 'Посещаемость обновлена', body: 'Данные о посещаемости изменились.', inbox: null },
    'grade.created': { type: 'other', category: 'important', title: 'Новая оценка', body: 'Опубликована новая оценка.', inbox: null },
    'sync.completed': { type: 'system', category: 'system', title: 'Синхронизация завершена', body: 'Данные успешно обновлены.', inbox: null },
    'sync.failed': { type: 'system', category: 'important', title: 'Ошибка синхронизации', body: 'Синхронизация завершилась с ошибкой.', inbox: { title: 'Разбери ошибку синхронизации', description: 'Открой детали и повтори синхронизацию после исправления.' } },
  };
  const base = mappings[event.type] ?? { type: 'other', category: 'all', title: 'Новое событие', body: 'Данные обновились.', inbox: null };
  return { ...base, deepLink, actions: [action], dueAt: null };
}

function isQuietHours(preferences: NotificationPreference): boolean {
  if (!preferences.quietHoursStart || !preferences.quietHoursEnd) return false;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(preferences.quietHoursStart);
  const end = toMinutes(preferences.quietHoursEnd);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
