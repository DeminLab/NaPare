import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonChange)
    private readonly lessonChangeRepository: Repository<LessonChange>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findById(id: string): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    return lesson;
  }

  async getLessonChanges(lessonId: string): Promise<LessonChange[]> {
    return this.lessonChangeRepository.find({
      where: { lessonId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByDate(universityId: string, date: string): Promise<Lesson[]> {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    return this.lessonRepository.find({
      where: {
        universityId,
        startDate: Between(startDate, endDate),
      },
      order: { pairNumber: 'ASC' },
    });
  }

  async findByDateRange(
    universityId: string,
    startDate: string,
    endDate: string,
  ): Promise<Lesson[]> {
    return this.lessonRepository.find({
      where: {
        universityId,
        startDate: Between(new Date(startDate), new Date(endDate)),
      },
      order: { startDate: 'ASC', pairNumber: 'ASC' },
    });
  }

  async findByGroup(
    universityId: string,
    groupId: string,
    date: string,
  ): Promise<Lesson[]> {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    return this.lessonRepository.find({
      where: {
        universityId,
        groupId,
        startDate: Between(startDate, endDate),
      },
      order: { pairNumber: 'ASC' },
    });
  }

  async findByTeacher(
    universityId: string,
    teacherId: string,
    date: string,
  ): Promise<Lesson[]> {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    return this.lessonRepository.find({
      where: {
        universityId,
        teacherId,
        startDate: Between(startDate, endDate),
      },
      order: { pairNumber: 'ASC' },
    });
  }

  async create(createLessonDto: CreateLessonDto): Promise<Lesson> {
    const lesson = this.lessonRepository.create(createLessonDto);
    return this.lessonRepository.save(lesson);
  }

  async update(id: string, updateLessonDto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const oldValue = { ...lesson };
    Object.assign(lesson, updateLessonDto);

    const updatedLesson = await this.lessonRepository.save(lesson);

    // Record change
    await this.lessonChangeRepository.save({
      lessonId: lesson.id,
      changeType: 'moved',
      oldValues: oldValue as any,
      newValues: updatedLesson as any,
    });

    // Emit change event
    this.eventEmitter.emit('lesson.changed', {
      universityId: lesson.universityId,
      lessonId: lesson.id,
      oldValue,
      newValue: updatedLesson,
    });

    return updatedLesson;
  }

  async delete(id: string): Promise<void> {
    await this.lessonRepository.delete(id);
  }

  async importLessons(
    universityId: string,
    lessons: CreateLessonDto[],
  ): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;

    for (const lessonData of lessons) {
      const existingLesson = await this.lessonRepository.findOne({
        where: {
          universityId,
          groupId: lessonData.groupId,
          dayOfWeek: lessonData.dayOfWeek,
          pairNumber: lessonData.pairNumber,
        },
      });

      if (existingLesson) {
        await this.update(existingLesson.id, lessonData);
        updated++;
      } else {
        await this.create({ ...lessonData, universityId });
        imported++;
      }
    }

    this.logger.log(
      `Imported ${imported} lessons, updated ${updated} lessons for university ${universityId}`,
    );

    return { imported, updated };
  }

  async getChangedLessons(universityId: string, date: string): Promise<Lesson[]> {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    return this.lessonRepository.find({
      where: {
        universityId,
        startDate: Between(startDate, endDate),
        isChanged: true,
      },
      order: { pairNumber: 'ASC' },
    });
  }
}
