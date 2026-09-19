import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { JsonObject } from '../common/types/json-value.type';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class ChangeDetectorService {
  private readonly logger = new Logger(ChangeDetectorService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonChange)
    private readonly lessonChangeRepository: Repository<LessonChange>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async detectChanges(
    universityId: string,
    newLessons: CreateLessonDto[],
  ): Promise<LessonChange[]> {
    const changes: LessonChange[] = [];

    for (const newLesson of newLessons) {
      const existingLesson = await this.lessonRepository.findOne({
        where: {
          universityId,
          groupId: newLesson.groupId,
          dayOfWeek: newLesson.dayOfWeek,
          pairNumber: newLesson.pairNumber,
        },
      });

      if (existingLesson) {
        const diff = this.compareLessons(existingLesson, newLesson);

        if (diff.hasChanges) {
          const change = await this.lessonChangeRepository.save({
            lessonId: existingLesson.id,
            changeType: diff.changeType,
            oldValues: diff.oldValues,
            newValues: diff.newValues,
            reason: diff.changeDescription,
            source: newLesson.source ?? 'sync',
          });

          changes.push(change);

          // Update lesson with changes
          await this.lessonRepository.update(existingLesson.id, {
            ...newLesson,
            isChanged: true,
            changeDescription: diff.changeDescription,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
          });

          // Emit change event
          this.eventEmitter.emit('lesson.changed', {
            universityId,
            lessonId: existingLesson.id,
            oldValue: diff.oldValues,
            newValue: diff.newValues,
            changeDescription: diff.changeDescription,
          });

          const type = diff.changeType === 'room_changed'
            ? 'room.changed'
            : diff.changeType === 'moved'
              ? 'lesson.rescheduled'
              : 'lesson.changed';
          await this.eventBus?.publish({
            type,
            universityId,
            actor: { type: 'system' },
            target: { type: 'lesson', id: existingLesson.id },
            payload: {
              oldValue: diff.oldValues,
              newValue: diff.newValues,
              groupId: existingLesson.groupId,
              teacherId: existingLesson.teacherId,
              changeDescription: diff.changeDescription,
              deepLink: `/schedule?lessonId=${existingLesson.id}`,
            },
            priority: 'high',
          });
        }
      }
    }

    if (changes.length > 0) {
      this.logger.log(
        `Detected ${changes.length} changes for university ${universityId}`,
      );
    }

    return changes;
  }

  private compareLessons(oldLesson: Lesson, newLesson: CreateLessonDto): {
    hasChanges: boolean;
    changeType: LessonChange['changeType'];
    changeDescription: string;
    oldValues: JsonObject;
    newValues: JsonObject;
  } {
    const changes: string[] = [];
    const oldValues: JsonObject = {};
    const newValues: JsonObject = {};
    let changeType: LessonChange['changeType'] = 'moved';

    // Check room change
    if (oldLesson.room !== newLesson.room) {
      changes.push('аудитория');
      oldValues.room = oldLesson.room;
      newValues.room = newLesson.room ?? null;
      changeType = 'room_changed';
    }

    // Check building change
    if (oldLesson.building !== newLesson.building) {
      changes.push('корпус');
      oldValues.building = oldLesson.building;
      newValues.building = newLesson.building ?? null;
    }

    // Check teacher change
    if (oldLesson.teacherName !== newLesson.teacherName) {
      changes.push('преподаватель');
      oldValues.teacherName = oldLesson.teacherName;
      newValues.teacherName = newLesson.teacherName ?? null;
      changeType = 'teacher_changed';
    }

    // Check time change
    if (oldLesson.startTime !== newLesson.startTime) {
      changes.push('время начала');
      oldValues.startTime = oldLesson.startTime;
      newValues.startTime = newLesson.startTime;
    }

    if (oldLesson.endTime !== newLesson.endTime) {
      changes.push('время окончания');
      oldValues.endTime = oldLesson.endTime;
      newValues.endTime = newLesson.endTime;
    }

    return {
      hasChanges: changes.length > 0,
      changeType,
      changeDescription: changes.join(', '),
      oldValues,
      newValues,
    };
  }
}
