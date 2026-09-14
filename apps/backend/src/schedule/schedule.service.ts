import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository, Between } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Lesson } from './entities/lesson.entity';
import { LessonChange } from './entities/lesson-change.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { TenantContext } from '../common/tenant/tenant-context';
import { getDayRange } from './utils/date-range';
import { JsonObject } from '../common/types/json-value.type';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from '../common/dto/pagination-query.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonChange)
    private readonly lessonChangeRepository: Repository<LessonChange>,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenantContext: TenantContext,
  ) {}

  async findById(id: string): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    this.tenantContext.assertAccess(lesson.universityId);

    return lesson;
  }

  async getLessonChanges(
    lessonId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<LessonChange>> {
    await this.findById(lessonId);
    const [data, total] = await this.lessonChangeRepository.findAndCount({
      where: { lessonId },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findByDate(
    universityId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated({
      where: {
        universityId,
        startDate: Between(startDate, endDate),
      },
      order: { pairNumber: 'ASC' },
    }, pagination);
  }

  async findByDateRange(
    universityId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    return this.findPaginated({
      where: {
        universityId,
        startDate: Between(new Date(startDate), new Date(endDate)),
      },
      order: { startDate: 'ASC', pairNumber: 'ASC' },
    }, pagination);
  }

  async findByGroup(
    universityId: string,
    groupId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated({
      where: {
        universityId,
        groupId,
        startDate: Between(startDate, endDate),
      },
      order: { pairNumber: 'ASC' },
    }, pagination);
  }

  async findByTeacher(
    universityId: string,
    teacherId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated({
      where: {
        universityId,
        teacherId,
        startDate: Between(startDate, endDate),
      },
      order: { pairNumber: 'ASC' },
    }, pagination);
  }

  async create(createLessonDto: CreateLessonDto): Promise<Lesson> {
    if (createLessonDto.universityId) {
      this.tenantContext.assertAccess(createLessonDto.universityId);
    }
    const lesson = this.lessonRepository.create(createLessonDto);
    return this.lessonRepository.save(lesson);
  }

  async update(id: string, updateLessonDto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    this.tenantContext.assertAccess(lesson.universityId);

    const oldValue = lessonChangeValues(lesson);
    Object.assign(lesson, updateLessonDto);

    const updatedLesson = await this.lessonRepository.save(lesson);

    // Record change
    await this.lessonChangeRepository.save({
      lessonId: lesson.id,
      changeType: 'moved',
      oldValues: oldValue,
      newValues: lessonChangeValues(updatedLesson),
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
    const lesson = await this.findById(id);
    await this.lessonRepository.delete(lesson.id);
  }

  async importLessons(
    universityId: string,
    lessons: CreateLessonDto[],
  ): Promise<{ imported: number; updated: number }> {
    this.tenantContext.assertAccess(universityId);
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

  async getChangedLessons(
    universityId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated({
      where: {
        universityId,
        startDate: Between(startDate, endDate),
        isChanged: true,
      },
      order: { pairNumber: 'ASC' },
    }, pagination);
  }

  private async findPaginated(
    options: FindManyOptions<Lesson>,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Lesson>> {
    const [data, total] = await this.lessonRepository.findAndCount({
      ...options,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }
}

function lessonChangeValues(lesson: Lesson): JsonObject {
  return {
    subject: lesson.subject,
    subjectType: lesson.subjectType ?? null,
    room: lesson.room ?? null,
    building: lesson.building ?? null,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    pairNumber: lesson.pairNumber,
    teacherId: lesson.teacherId ?? null,
    teacherName: lesson.teacherName ?? null,
    startDate: lesson.startDate.toISOString(),
    endDate: lesson.endDate.toISOString(),
  };
}
