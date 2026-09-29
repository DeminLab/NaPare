import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';

import { EventBusService } from '../events/event-bus.service';
import { Homework } from '../pair-space/entities/homework.entity';
import { Lesson } from '../schedule/entities/lesson.entity';

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const BATCH_SIZE = 500;

@Injectable()
export class HomeworkDeadlineReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HomeworkDeadlineReminderService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private checkInProgress = false;

  constructor(
    @InjectRepository(Homework)
    private readonly homeworkRepository: Repository<Homework>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.checkDueDeadlines(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async checkDueDeadlines(now = new Date()): Promise<void> {
    if (this.checkInProgress) return;
    this.checkInProgress = true;
    try {
      const until = new Date(now.getTime() + REMINDER_WINDOW_MS);
      let skip = 0;
      while (true) {
        const homeworkItems = await this.homeworkRepository.find({
          where: { isCompleted: false, deadline: Between(now, until) },
          relations: { pairSpace: true },
          order: { deadline: 'ASC', id: 'ASC' },
          skip,
          take: BATCH_SIZE,
        });
        if (homeworkItems.length === 0) break;

        const validPairSpaces = homeworkItems
          .map((homework) => homework.pairSpace)
          .filter((pairSpace) => pairSpace?.isActive);
        const lessonIds = [...new Set(validPairSpaces.map((pairSpace) => pairSpace.lessonId))];
        const universityIds = [...new Set(validPairSpaces.map((pairSpace) => pairSpace.universityId))];
        const lessons = lessonIds.length
          ? await this.lessonRepository.find({ where: { id: In(lessonIds), universityId: In(universityIds) } })
          : [];
        const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

        for (const homework of homeworkItems) {
          const pairSpace = homework.pairSpace;
          if (!pairSpace?.isActive || !homework.deadline) continue;
          const lesson = lessonsById.get(pairSpace.lessonId);
          if (!lesson || lesson.universityId !== pairSpace.universityId) continue;

          try {
            await this.eventBus.publish({
              type: 'homework.deadline_soon',
              idempotencyKey: `homework-deadline:${homework.id}:${homework.deadline.toISOString()}`,
              universityId: pairSpace.universityId,
              target: { type: 'homework', id: homework.id },
              priority: homework.deadline.getTime() - now.getTime() <= 6 * 60 * 60 * 1000 ? 'high' : 'normal',
              payload: {
                groupId: lesson.groupId,
                ...(lesson.teacherId ? { teacherId: lesson.teacherId } : {}),
                homeworkTitle: homework.title,
                deadline: homework.deadline.toISOString(),
                subject: pairSpace.subject,
                groupName: lesson.groupName ?? '',
                lessonId: lesson.id,
                pairSpaceId: pairSpace.id,
                deepLink: `/pair-space/${lesson.id}`,
              },
            });
          } catch (error) {
            this.logger.error(`Failed to publish deadline reminder for homework ${homework.id}`, error);
          }
        }

        if (homeworkItems.length < BATCH_SIZE) break;
        skip += homeworkItems.length;
      }
    } catch (error) {
      this.logger.error('Failed to scan upcoming homework deadlines', error);
    } finally {
      this.checkInProgress = false;
    }
  }
}
