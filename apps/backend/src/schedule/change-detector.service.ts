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
              subject: newLesson.subject,
              oldValue: diff.oldValues,
              newValue: diff.newValues,
              groupId: existingLesson.groupId,
              teacherId: existingLesson.teacherId,
              changeDescription: diff.changeDescription,
              deepLink: `/pair-space/${existingLesson.id}`,
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

    const displayValue = (value: unknown, field: string) => {
      if (value === null || value === undefined || value === '') return 'не указано';
      if (field === 'startTime' || field === 'endTime') return String(value).slice(0, 5);
      if (field === 'startDate') {
        const [year, month, day] = String(value).slice(0, 10).split('-');
        return `${day}.${month}.${year}`;
      }
      if (field === 'weekType') {
        return ({ odd: 'нечётная неделя', even: 'чётная неделя', both: 'обе недели' } as Record<string, string>)[String(value)] ?? String(value);
      }
      return String(value);
    };

    const compare = (
      field: string,
      label: string,
      oldValue: unknown,
      newValue: unknown,
      normalize: (value: unknown) => string = value => String(value ?? '').trim(),
    ) => {
      if (normalize(oldValue) === normalize(newValue)) return;
      oldValues[field] = oldValue == null ? null : String(oldValue);
      newValues[field] = newValue == null ? null : String(newValue);
      changes.push(`${label}: ${displayValue(oldValue, field)} → ${displayValue(newValue, field)}`);
    };

    const oldStartDate = new Date(oldLesson.startDate).toISOString().slice(0, 10);
    const newStartDate = new Date(newLesson.startDate).toISOString().slice(0, 10);
    compare('startDate', 'Дата', oldStartDate, newStartDate);
    compare('startTime', 'Начало', oldLesson.startTime, newLesson.startTime, value => String(value ?? '').slice(0, 5));
    compare('endTime', 'Окончание', oldLesson.endTime, newLesson.endTime, value => String(value ?? '').slice(0, 5));
    compare('room', 'Аудитория', oldLesson.room, newLesson.room);
    compare('building', 'Корпус', oldLesson.building, newLesson.building);
    compare('teacherName', 'Преподаватель', oldLesson.teacherName, newLesson.teacherName);
    compare('subject', 'Предмет', oldLesson.subject, newLesson.subject);
    compare('subjectType', 'Тип занятия', oldLesson.subjectType, newLesson.subjectType);
    compare('subgroup', 'Подгруппа', oldLesson.subgroup, newLesson.subgroup);
    compare('weekType', 'Неделя', oldLesson.weekType, newLesson.weekType);

    if (changes.some(change => change.startsWith('Аудитория:') || change.startsWith('Корпус:'))) {
      changeType = 'room_changed';
    }
    if (changes.some(change => change.startsWith('Преподаватель:'))) {
      changeType = 'teacher_changed';
    }
    if (changes.some(change => change.startsWith('Дата:') || change.startsWith('Начало:') || change.startsWith('Окончание:'))) {
      changeType = 'moved';
    }
    if (changeType === 'moved' && changes.length > 0 && !changes.some(change => /^(Дата|Начало|Окончание):/.test(change))) {
      changeType = 'updated';
    }

    return {
      hasChanges: changes.length > 0,
      changeType,
      changeDescription: changes.join('; '),
      oldValues,
      newValues,
    };
  }
}
