import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { EventEnvelope } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';
import { UserRole } from '../../auth/interfaces/user-role';

@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  @OnEvent('napare.event', { async: true })
  async handle(event: EventEnvelope): Promise<void> {
    try {
      const recipientIds = await this.resolveRecipients(event);
      if (recipientIds.length === 0) return;
      await this.notificationsService.processEvent(event, recipientIds);
    } catch (error) {
      this.logger.error(`Failed to fan out event ${event.id}`, error);
    }
  }

  private async resolveRecipients(event: EventEnvelope): Promise<string[]> {
    if (event.recipients?.length) return event.recipients;

    if (event.type === 'sync.completed' || event.type === 'sync.failed') {
      const operators = await this.usersRepository.find({
        where: {
          universityId: event.university.id,
          isActive: true,
          role: In([UserRole.DEVELOPER, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN]),
        },
        select: ['id'],
      });
      return operators.map((user) => user.id);
    }

    const groupId = typeof event.payload.groupId === 'string' ? event.payload.groupId : undefined;
    const teacherId = typeof event.payload.teacherId === 'string' ? event.payload.teacherId : undefined;
    if (groupId) {
      const students = await this.usersRepository.find({
        where: { universityId: event.university.id, groupId, isActive: true },
        select: ['id'],
      });
      return [...new Set([
        ...students.map((student) => student.id),
        ...(teacherId ? [teacherId] : []),
      ])];
    }

    const users = await this.usersRepository.find({
      where: { universityId: event.university.id, isActive: true },
      select: ['id'],
    });
    return users.map((user) => user.id);
  }
}
