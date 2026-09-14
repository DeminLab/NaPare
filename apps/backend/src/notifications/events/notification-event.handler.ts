import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NotificationsService } from '../notifications.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { JsonObject } from '../../common/types/json-value.type';

@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('lesson.changed')
  async handleLessonChanged(event: {
    universityId: string;
    lessonId: string;
    oldValue: JsonObject;
    newValue: JsonObject;
    changeDescription: string;
  }) {
    this.logger.log(`Lesson changed: ${event.lessonId}`);

    // TODO: Find affected students and send notifications
    // This is a placeholder for the actual implementation
    const notification: CreateNotificationDto = {
      userId: '', // Will be filled with actual student IDs
      universityId: event.universityId,
      title: 'Изменение в расписании',
      body: `Изменения: ${event.changeDescription}`,
      type: 'schedule_change',
      data: {
        lessonId: event.lessonId,
        changes: event.changeDescription,
      },
      deepLink: `/schedule?lessonId=${event.lessonId}`,
    };

    // TODO: Send push notifications to affected students
    this.logger.log('Lesson change notification prepared');
  }

  @OnEvent('homework.created')
  async handleHomeworkCreated(event: {
    universityId: string;
    studentIds: string[];
    homeworkTitle: string;
    subject: string;
    deadline: Date;
  }) {
    this.logger.log(`Homework created: ${event.homeworkTitle}`);

    // TODO: Send notifications to students
    this.logger.log('Homework notification prepared');
  }

  @OnEvent('announcement.created')
  async handleAnnouncementCreated(event: {
    universityId: string;
    studentIds: string[];
    title: string;
    content: string;
  }) {
    this.logger.log(`Announcement created: ${event.title}`);

    // TODO: Send notifications to students
    this.logger.log('Announcement notification prepared');
  }
}
