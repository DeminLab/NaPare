import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';

@Injectable()
export class ChangeDetectorService {
  private readonly logger = new Logger(ChangeDetectorService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonChange)
    private readonly lessonChangeRepository: Repository<LessonChange>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async detectChanges(
    universityId: string,
    newLessons: any[],
  ): Promise<LessonChange[]> {
    const changes: LessonChange[] = [];

    for (const newLesson of newLessons) {
      const existingLesson = await this.lessonRepository.findOne({
        where: {
          universityId,
          date: newLesson.date,
          pairNumber: newLesson.pairNumber,
          group: newLesson.group,
        },
      });

      if (existingLesson) {
        const diff = this.compareLessons(existingLesson, newLesson);

        if (diff.hasChanges) {
          const change = await this.lessonChangeRepository.save({
            universityId,
            lessonId: existingLesson.id,
            oldValue: diff.oldValues,
            newValue: diff.newValues,
            changeType: 'auto',
            reason: diff.changeDescription,
          });

          changes.push(change);

          // Update lesson with changes
          await this.lessonRepository.update(existingLesson.id, {
            ...newLesson,
            isChanged: true,
            changeDescription: diff.changeDescription,
          });

          // Emit change event
          this.eventEmitter.emit('lesson.changed', {
            universityId,
            lessonId: existingLesson.id,
            oldValue: diff.oldValues,
            newValue: diff.newValues,
            changeDescription: diff.changeDescription,
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

  private compareLessons(oldLesson: Lesson, newLesson: any) {
    const changes: string[] = [];
    const oldValues: any = {};
    const newValues: any = {};

    // Check room change
    if (oldLesson.room !== newLesson.room) {
      changes.push('аудитория');
      oldValues.room = oldLesson.room;
      newValues.room = newLesson.room;
    }

    // Check building change
    if (oldLesson.building !== newLesson.building) {
      changes.push('корпус');
      oldValues.building = oldLesson.building;
      newValues.building = newLesson.building;
    }

    // Check teacher change
    if (oldLesson.teacherName !== newLesson.teacherName) {
      changes.push('преподаватель');
      oldValues.teacherName = oldLesson.teacherName;
      newValues.teacherName = newLesson.teacherName;
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
      changeDescription: changes.join(', '),
      oldValues,
      newValues,
    };
  }
}
