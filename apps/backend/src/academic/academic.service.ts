import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { EventBusService } from '../events/event-bus.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { PaginatedResponse, PaginationQueryDto, toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { Course } from './entities/course.entity';
import { LessonSeries } from './entities/lesson-series.entity';
import { LessonOccurrence } from './entities/lesson-occurrence.entity';
import { AcademicEvent } from './entities/academic-event.entity';
import { CourseSpace } from './entities/course-space.entity';
import { LessonSpace } from './entities/lesson-space.entity';
import { ScheduleChange } from './entities/schedule-change.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateLessonSeriesDto } from './dto/create-lesson-series.dto';
import { CreateLessonOccurrenceDto } from './dto/create-lesson-occurrence.dto';
import { UpdateLessonOccurrenceDto } from './dto/update-lesson-occurrence.dto';
import { AcademicEventQueryDto } from './dto/academic-event-query.dto';
import { CreateAcademicEventDto } from './dto/create-academic-event.dto';
import { AcademicEventPayload } from './academic.types';
import { hasPermission, PERMISSIONS } from '../common/authorization/permissions';

const UNIVERSITY_OPERATORS = [
  UserRole.UNIVERSITY_ADMIN,
  UserRole.FACULTY_DEAN,
  UserRole.DEPARTMENT_HEAD,
  UserRole.SUPERADMIN,
];

@Injectable()
export class AcademicService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(LessonSeries)
    private readonly seriesRepository: Repository<LessonSeries>,
    @InjectRepository(LessonOccurrence)
    private readonly occurrenceRepository: Repository<LessonOccurrence>,
    @InjectRepository(AcademicEvent)
    private readonly eventRepository: Repository<AcademicEvent>,
    @InjectRepository(CourseSpace)
    private readonly courseSpaceRepository: Repository<CourseSpace>,
    @InjectRepository(LessonSpace)
    private readonly lessonSpaceRepository: Repository<LessonSpace>,
    @InjectRepository(ScheduleChange)
    private readonly scheduleChangeRepository: Repository<ScheduleChange>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
    private readonly tenantContext: TenantContext,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async findCourses(universityId: string, pagination: PaginationQueryDto): Promise<PaginatedResponse<Course>> {
    const user = this.requireUser();
    this.tenantContext.assertAccess(universityId);
    const query = this.courseRepository.createQueryBuilder('course')
      .where('course.universityId = :universityId', { universityId })
      .andWhere('course.isActive = true');

    this.applyCourseScope(query, user);
    query.orderBy('course.name', 'ASC')
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit);

    const [data, total] = await query.getManyAndCount();
    return toPaginatedResponse(data, total, pagination);
  }

  async getCourse(id: string): Promise<Course> {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) throw new NotFoundException(`Course with id ${id} not found`);
    await this.assertCourseReadable(course);
    return course;
  }

  async createCourse(universityId: string, dto: CreateCourseDto): Promise<Course> {
    const user = this.requireUser();
    this.assertUniversityOperator(user, universityId);
    if (dto.facultyId) {
      const faculty = await this.facultyRepository.findOne({ where: { id: dto.facultyId, universityId } });
      if (!faculty) throw new NotFoundException('Faculty not found in this university');
    }

    return this.dataSource.transaction(async (manager) => {
      const course = await manager.getRepository(Course).save(manager.getRepository(Course).create({
        ...dto,
        universityId,
        syncStatus: 'synced',
        source: 'manual',
      }));
      await manager.getRepository(CourseSpace).save(manager.getRepository(CourseSpace).create({
        universityId,
        courseId: course.id,
        name: course.name,
      }));
      return course;
    });
  }

  async updateCourse(id: string, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.getCourse(id);
    this.assertUniversityOperator(this.requireUser(), course.universityId);
    if (dto.facultyId) {
      const faculty = await this.facultyRepository.findOne({ where: { id: dto.facultyId, universityId: course.universityId } });
      if (!faculty) throw new NotFoundException('Faculty not found in this university');
    }
    Object.assign(course, dto);
    const updated = await this.courseRepository.save(course);
    await this.courseSpaceRepository.update({ courseId: course.id }, { name: updated.name });
    return updated;
  }

  async findSeries(courseId: string, pagination: PaginationQueryDto): Promise<PaginatedResponse<LessonSeries>> {
    const course = await this.getCourse(courseId);
    const [data, total] = await this.seriesRepository.findAndCount({
      where: { courseId: course.id, universityId: course.universityId },
      order: { dayOfWeek: 'ASC', pairNumber: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async createSeries(courseId: string, dto: CreateLessonSeriesDto): Promise<LessonSeries> {
    const course = await this.getCourse(courseId);
    await this.assertCourseManageable(course);
    await this.assertGroup(course.universityId, dto.groupId);
    const user = this.requireUser();
    const teacherId = dto.teacherId ?? (user.role === UserRole.TEACHER ? user.id : null);
    if (user.role === UserRole.TEACHER && teacherId !== user.id) {
      throw new ForbiddenException('Teacher can only create their own lesson series');
    }
    return this.seriesRepository.save(this.seriesRepository.create({
      ...dto,
      courseId: course.id,
      universityId: course.universityId,
      teacherId,
      validFrom: new Date(dto.validFrom),
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      source: 'manual',
      syncStatus: 'synced',
    }));
  }

  async findOccurrences(
    universityId: string,
    queryDto: AcademicEventQueryDto,
  ): Promise<PaginatedResponse<LessonOccurrence>> {
    const user = this.requireUser();
    this.tenantContext.assertAccess(universityId);
    const query = this.occurrenceRepository.createQueryBuilder('occurrence')
      .where('occurrence.universityId = :universityId', { universityId });
    if (queryDto.courseId) query.andWhere('occurrence.courseId = :courseId', { courseId: queryDto.courseId });
    if (queryDto.groupId) query.andWhere('occurrence.groupId = :groupId', { groupId: queryDto.groupId });
    if (queryDto.from) query.andWhere('occurrence.startsAt >= :from', { from: new Date(queryDto.from) });
    if (queryDto.to) query.andWhere('occurrence.startsAt < :to', { to: new Date(queryDto.to) });
    this.applyOccurrenceScope(query, user);
    query.orderBy('occurrence.startsAt', 'ASC')
      .skip((queryDto.page - 1) * queryDto.limit)
      .take(queryDto.limit);
    const [data, total] = await query.getManyAndCount();
    return toPaginatedResponse(data, total, queryDto);
  }

  async createOccurrence(seriesId: string, dto: CreateLessonOccurrenceDto): Promise<LessonOccurrence> {
    const series = await this.seriesRepository.findOne({ where: { id: seriesId } });
    if (!series) throw new NotFoundException(`Lesson series with id ${seriesId} not found`);
    await this.assertCourseManageable(await this.getCourse(series.courseId));
    const occurrence = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(LessonOccurrence).save(manager.getRepository(LessonOccurrence).create({
        ...dto,
        seriesId: series.id,
        universityId: series.universityId,
        courseId: series.courseId,
        groupId: series.groupId,
        teacherId: series.teacherId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        status: dto.status ?? 'scheduled',
        room: dto.room ?? series.room,
        building: dto.building ?? series.building,
        source: 'manual',
        syncStatus: 'synced',
      }));
      const courseSpace = await manager.getRepository(CourseSpace).findOne({ where: { courseId: saved.courseId } });
      if (courseSpace) {
        await manager.getRepository(LessonSpace).save(manager.getRepository(LessonSpace).create({
          universityId: saved.universityId,
          courseSpaceId: courseSpace.id,
          occurrenceId: saved.id,
          name: `${courseSpace.name} — ${saved.startsAt.toISOString().slice(0, 10)}`,
        }));
      }
      return saved;
    });
    await this.recordAcademicEvent({
      universityId: occurrence.universityId,
      type: 'lesson',
      courseId: occurrence.courseId,
      groupId: occurrence.groupId,
      occurrenceId: occurrence.id,
      actorId: this.requireUser().id,
      title: 'Занятие создано',
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      payload: { occurrenceId: occurrence.id },
    });
    return occurrence;
  }

  async updateOccurrence(id: string, dto: UpdateLessonOccurrenceDto): Promise<LessonOccurrence> {
    const occurrence = await this.occurrenceRepository.findOne({ where: { id } });
    if (!occurrence) throw new NotFoundException(`Lesson occurrence with id ${id} not found`);
    await this.assertCourseManageable(await this.getCourse(occurrence.courseId));
    const originalValue = occurrenceSnapshot(occurrence);
    Object.assign(occurrence, {
      ...dto,
      ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
    });
    const actor = this.requireUser();
    const updated = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(LessonOccurrence).save(occurrence);
      const change = await manager.getRepository(ScheduleChange).save(manager.getRepository(ScheduleChange).create({
        universityId: saved.universityId,
        occurrenceId: saved.id,
        originalValue,
        newValue: occurrenceSnapshot(saved),
        reason: dto.changeReason ?? 'Academic occurrence updated',
        actorId: actor.id,
        source: 'manual',
        timestamp: new Date(),
      }));
      return { saved, changeId: change.id };
    });
    const eventType = originalValue.room !== updated.saved.room
      ? 'room.changed'
      : originalValue.startsAt !== updated.saved.startsAt.toISOString()
        || originalValue.endsAt !== updated.saved.endsAt.toISOString()
        ? 'lesson.rescheduled'
        : 'lesson.changed';
    await this.eventBus.publish({
      idempotencyKey: `academic-schedule-change:${updated.changeId}`,
      type: eventType,
      universityId: updated.saved.universityId,
      actor: { id: actor.id, type: 'user', role: actor.role },
      target: { type: 'lesson_occurrence', id: updated.saved.id },
      payload: {
        originalValue,
        newValue: occurrenceSnapshot(updated.saved),
        reason: dto.changeReason ?? null,
        source: 'manual',
        groupId: updated.saved.groupId,
        teacherId: updated.saved.teacherId,
        deepLink: `/academic/occurrences/${updated.saved.id}`,
      },
      priority: 'high',
    });
    return updated.saved;
  }

  async getOccurrenceContext(id: string): Promise<{ course: Course; series: LessonSeries; occurrence: LessonOccurrence }> {
    const occurrence = await this.occurrenceRepository.findOne({ where: { id } });
    if (!occurrence) throw new NotFoundException(`Lesson occurrence with id ${id} not found`);
    const course = await this.getCourse(occurrence.courseId);
    const series = await this.seriesRepository.findOne({ where: { id: occurrence.seriesId } });
    if (!series) throw new NotFoundException(`Lesson series with id ${occurrence.seriesId} not found`);
    return { course, series, occurrence };
  }

  async getCourseSpace(courseId: string): Promise<CourseSpace> {
    const course = await this.getCourse(courseId);
    const space = await this.courseSpaceRepository.findOne({ where: { courseId: course.id, universityId: course.universityId } });
    if (!space) throw new NotFoundException(`Course space for ${courseId} not found`);
    return space;
  }

  async getLessonSpace(occurrenceId: string): Promise<LessonSpace> {
    const context = await this.getOccurrenceContext(occurrenceId);
    const courseSpace = await this.getCourseSpace(context.course.id);
    const space = await this.lessonSpaceRepository.findOne({
      where: {
        occurrenceId: context.occurrence.id,
        courseSpaceId: courseSpace.id,
        universityId: context.occurrence.universityId,
      },
    });
    if (!space) throw new NotFoundException(`Lesson space for ${occurrenceId} not found`);
    return space;
  }

  async findAcademicEvents(universityId: string, queryDto: AcademicEventQueryDto): Promise<PaginatedResponse<AcademicEvent>> {
    const user = this.requireUser();
    this.tenantContext.assertAccess(universityId);
    const query = this.eventRepository.createQueryBuilder('event')
      .where('event.universityId = :universityId', { universityId });
    if (queryDto.type) query.andWhere('event.type = :type', { type: queryDto.type });
    if (queryDto.courseId) query.andWhere('event.courseId = :courseId', { courseId: queryDto.courseId });
    if (queryDto.groupId) query.andWhere('event.groupId = :groupId', { groupId: queryDto.groupId });
    if (queryDto.from) query.andWhere('event.startsAt >= :from', { from: new Date(queryDto.from) });
    if (queryDto.to) query.andWhere('event.startsAt < :to', { to: new Date(queryDto.to) });
    this.applyEventScope(query, user);
    query.orderBy('event.startsAt', 'ASC', 'NULLS LAST')
      .addOrderBy('event.createdAt', 'DESC')
      .skip((queryDto.page - 1) * queryDto.limit)
      .take(queryDto.limit);
    const [data, total] = await query.getManyAndCount();
    return toPaginatedResponse(data, total, queryDto);
  }

  async createAcademicEvent(universityId: string, dto: CreateAcademicEventDto): Promise<AcademicEvent> {
    const actor = this.requireUser();
    this.tenantContext.assertAccess(universityId);
    if (dto.courseId) await this.assertCourseManageable(await this.getCourse(dto.courseId));
    if (dto.groupId) await this.assertGroup(universityId, dto.groupId);
    return this.recordAcademicEvent({
      universityId,
      type: dto.type,
      courseId: dto.courseId ?? null,
      groupId: dto.groupId ?? null,
      occurrenceId: dto.occurrenceId ?? null,
      actorId: actor.id,
      title: dto.title,
      description: dto.description ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      payload: {},
    });
  }

  async listScheduleChanges(occurrenceId: string, pagination: PaginationQueryDto): Promise<PaginatedResponse<ScheduleChange>> {
    const occurrence = await this.occurrenceRepository.findOne({ where: { id: occurrenceId } });
    if (!occurrence) throw new NotFoundException(`Lesson occurrence with id ${occurrenceId} not found`);
    await this.getCourse(occurrence.courseId);
    const [data, total] = await this.scheduleChangeRepository.findAndCount({
      where: { occurrenceId, universityId: occurrence.universityId },
      order: { timestamp: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  private async recordAcademicEvent(input: Partial<AcademicEvent> & Pick<AcademicEvent, 'universityId' | 'type' | 'title'>): Promise<AcademicEvent> {
    return this.eventRepository.save(this.eventRepository.create({
      ...input,
      priority: input.priority ?? 'normal',
      syncStatus: input.syncStatus ?? 'synced',
    }));
  }

  private applyCourseScope(query: ReturnType<Repository<Course>['createQueryBuilder']>, user: AuthenticatedUser): void {
    if (UNIVERSITY_OPERATORS.includes(user.role)) return;
    if (user.role === UserRole.TEACHER) {
      query.innerJoin(LessonSeries, 'teacher_series', 'teacher_series.courseId = course.id AND teacher_series.teacherId = :teacherId', { teacherId: user.id });
      return;
    }
    if (user.role === UserRole.STUDENT && user.groupId) {
      query.innerJoin(LessonSeries, 'student_series', 'student_series.courseId = course.id AND student_series.groupId = :studentGroupId', { studentGroupId: user.groupId });
      return;
    }
    if (user.role === UserRole.CURATOR) {
      query.innerJoin(LessonSeries, 'curator_series', 'curator_series.courseId = course.id')
        .innerJoin(Group, 'curator_group', 'curator_group.id = curator_series.groupId AND curator_group.curatorId = :curatorId', { curatorId: user.id });
      return;
    }
    query.andWhere('1 = 0');
  }

  private applyOccurrenceScope(query: ReturnType<Repository<LessonOccurrence>['createQueryBuilder']>, user: AuthenticatedUser): void {
    if (UNIVERSITY_OPERATORS.includes(user.role)) return;
    if (user.role === UserRole.TEACHER) query.andWhere('occurrence.teacherId = :teacherId', { teacherId: user.id });
    else if (user.role === UserRole.STUDENT && user.groupId) query.andWhere('occurrence.groupId = :studentGroupId', { studentGroupId: user.groupId });
    else if (user.role === UserRole.CURATOR) query.innerJoin(Group, 'occurrence_group', 'occurrence_group.id = occurrence.groupId AND occurrence_group.curatorId = :curatorId', { curatorId: user.id });
    else query.andWhere('1 = 0');
  }

  private applyEventScope(query: ReturnType<Repository<AcademicEvent>['createQueryBuilder']>, user: AuthenticatedUser): void {
    if (UNIVERSITY_OPERATORS.includes(user.role)) return;
    if (user.role === UserRole.TEACHER) query.andWhere('(event.actorId = :teacherId OR EXISTS (SELECT 1 FROM lesson_series event_series WHERE event_series.courseId = event.courseId AND event_series.teacherId = :teacherId))', { teacherId: user.id });
    else if (user.role === UserRole.STUDENT && user.groupId) query.andWhere('(event.groupId = :studentGroupId OR EXISTS (SELECT 1 FROM lesson_series event_series WHERE event_series.courseId = event.courseId AND event_series.groupId = :studentGroupId))', { studentGroupId: user.groupId });
    else if (user.role === UserRole.CURATOR) query.innerJoin(Group, 'event_group', 'event_group.id = event.groupId AND event_group.curatorId = :curatorId', { curatorId: user.id });
    else query.andWhere('1 = 0');
  }

  private async assertCourseReadable(course: Course): Promise<void> {
    const user = this.requireUser();
    this.tenantContext.assertAccess(course.universityId);
    if (UNIVERSITY_OPERATORS.includes(user.role)) return;
    if (user.role === UserRole.TEACHER && await this.seriesRepository.exists({ where: { courseId: course.id, teacherId: user.id } })) return;
    if (user.role === UserRole.STUDENT && user.groupId && await this.seriesRepository.exists({ where: { courseId: course.id, groupId: user.groupId } })) return;
    if (user.role === UserRole.CURATOR) {
      const group = await this.groupRepository.findOne({ where: { universityId: course.universityId, curatorId: user.id } });
      if (group && await this.seriesRepository.exists({ where: { courseId: course.id, groupId: group.id } })) return;
    }
    throw new ForbiddenException('Course is outside the user resource scope');
  }

  private async assertCourseManageable(course: Course): Promise<void> {
    const user = this.requireUser();
    await this.assertCourseReadable(course);
    if (UNIVERSITY_OPERATORS.includes(user.role)) return;
    if (user.role === UserRole.TEACHER && hasPermission(user.role, PERMISSIONS.ACADEMIC_SERIES_MANAGE)) return;
    if (user.role === UserRole.CURATOR && hasPermission(user.role, PERMISSIONS.ACADEMIC_SERIES_MANAGE)) return;
    throw new ForbiddenException('Course is outside the user write scope');
  }

  private assertUniversityOperator(user: AuthenticatedUser, universityId: string): void {
    this.tenantContext.assertAccess(universityId);
    if (!UNIVERSITY_OPERATORS.includes(user.role) || !hasPermission(user.role, PERMISSIONS.ACADEMIC_COURSE_MANAGE)) {
      throw new ForbiddenException('University operator permission required');
    }
  }

  private async assertGroup(universityId: string, groupId: string): Promise<Group> {
    const group = await this.groupRepository.findOne({ where: { id: groupId, universityId } });
    if (!group) throw new NotFoundException('Group not found in this university');
    const user = this.requireUser();
    if (user.role === UserRole.CURATOR && group.curatorId !== user.id) throw new ForbiddenException('Group is outside curator scope');
    return group;
  }

  private requireUser(): AuthenticatedUser {
    const user = this.tenantContext.getUser();
    if (!user) throw new ForbiddenException('User not authenticated');
    return user;
  }
}

function occurrenceSnapshot(occurrence: LessonOccurrence): AcademicEventPayload {
  return {
    id: occurrence.id,
    seriesId: occurrence.seriesId,
    courseId: occurrence.courseId,
    groupId: occurrence.groupId,
    teacherId: occurrence.teacherId,
    startsAt: occurrence.startsAt.toISOString(),
    endsAt: occurrence.endsAt.toISOString(),
    room: occurrence.room,
    building: occurrence.building,
    status: occurrence.status,
    changeReason: occurrence.changeReason,
  };
}
