import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, FindManyOptions, Repository, Between, In, And, Equal, IsNull, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual } from "typeorm";
import { OfficeAssignment } from '../requests/request.entities';
import { CurationService } from '../curation/curation.service';
import { EventEmitter2 } from "@nestjs/event-emitter";

import { Lesson } from "./entities/lesson.entity";
import { LessonChange } from "./entities/lesson-change.entity";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { UpdateLessonDto } from "./dto/update-lesson.dto";
import { TenantContext } from "../common/tenant/tenant-context";
import { getDayRange, getInclusiveDateBounds } from "./utils/date-range";
import { JsonObject } from "../common/types/json-value.type";
import { EventBusService } from "../events/event-bus.service";
import { LessonOccurrence } from "../academic/entities/lesson-occurrence.entity";
import { ScheduleChange } from "../academic/entities/schedule-change.entity";
import { RaspLesson, RaspScraperService } from "../auth/rasp-scraper.service";
import { Group } from "../users/entities/group.entity";
import { Faculty } from "../users/entities/faculty.entity";
import { User } from "../users/entities/user.entity";
import { UserRole } from "../auth/interfaces/user-role";
import { isPersistedLessonId, parseRaspLessonId } from "../common/identifiers/lesson-id";
import { LessonIdentifierService } from "../common/identifiers/lesson-identifier.service";
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from "../common/dto/pagination-query.dto";

export type ScheduleConflictType = "teacher" | "group" | "room";

export interface ScheduleConflict {
  type: ScheduleConflictType;
  lessonId: string;
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  dateFrom: string;
  dateTo: string;
  groupId: string | null;
  groupName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  room: string | null;
}

export interface ScheduleCandidate {
  organizationId?: string | null;
  groupId?: string | null;
  teacherId?: string | null;
  room?: string | null;
  /** 0=воскресенье … 6=суббота, как в legacy `lessons`. Без него проверка невозможна. */
  dayOfWeek?: number | null;
  startDate: Date | string;
  endDate: Date | string;
  startTime: string;
  endTime: string;
  weekType?: string | null;
}

const toDateKey = (value: Date | string): string =>
  (value instanceof Date ? value.toISOString() : new Date(value).toISOString()).slice(0, 10);

/**
 * A lesson occupies calendar days, not instants: `startDate` may arrive as
 * `YYYY-MM-DD` (midnight) while the stored row starts at 08:30. Comparing raw
 * instants then hides a real clash, so the day bounds widen to the whole day.
 */
const startOfDay = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const endOfDay = (value: Date): Date => new Date(startOfDay(value).getTime() + 86400000 - 1);

const conflictTypeLabel: Record<ScheduleConflictType, string> = {
  teacher: "преподаватель",
  group: "группа",
  room: "аудитория",
};

const describeScheduleConflict = (conflict: ScheduleConflict): string => {
  const who = conflict.type === "teacher"
    ? conflict.teacherName || "преподаватель"
    : conflict.type === "group"
      ? conflict.groupName || "группа"
      : conflict.room || "аудитория";
  return `${conflictTypeLabel[conflict.type]} ${who} занят(а): ${conflict.subject}, ${conflict.startTime}–${conflict.endTime}`;
};

@Injectable()
export class ScheduleService {  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(LessonChange)
    private readonly lessonChangeRepository: Repository<LessonChange>,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenantContext: TenantContext,
    private readonly dataSource: DataSource,
    @Optional()
    @InjectRepository(LessonOccurrence)
    private readonly occurrenceRepository?: Repository<LessonOccurrence>,
    @Optional()
    @InjectRepository(ScheduleChange)
    private readonly academicChangeRepository?: Repository<ScheduleChange>,
    @Optional() private readonly eventBus?: EventBusService,
    @Optional() private readonly raspScraperService?: RaspScraperService,
    @Optional()
    @InjectRepository(Group)
    private readonly groupRepository?: Repository<Group>,
    @Optional() private readonly curation?: CurationService,
    @Optional() private readonly lessonIdentifiers?: LessonIdentifierService,
  ) {}

  async findById(id: string): Promise<Lesson> {
    if (!isPersistedLessonId(id)) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    const lesson = await this.lessonRepository.findOne({ where: { id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    this.tenantContext.assertAccess(lesson.organizationId);
    if (this.tenantContext.getUser()?.role === UserRole.CURATOR && this.curation) await this.curation.assertGroup(lesson.groupId);

    return lesson;
  }

  async findAccessibleById(
    id: string,
    user: {
      id: string;
      organizationId: string;
      role: UserRole;
      groupId?: string | null;
    },
  ): Promise<Lesson> {
    const externalId = parseRaspLessonId(id);
    if (externalId) {
      if (user.role !== UserRole.STUDENT || !this.lessonIdentifiers) {
        throw new NotFoundException(`Lesson with id ${id} not found`);
      }
      const localLessonId = await this.lessonIdentifiers.resolvePersistedLessonId(
        id,
        user.organizationId,
      );
      if (!localLessonId) {
        throw new NotFoundException(`Lesson with id ${id} not found`);
      }
      id = localLessonId;
    }

    if (!isPersistedLessonId(id)) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    const lesson = await this.lessonRepository.findOne({
      where: { id, organizationId: user.organizationId },
    });
    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    if (user.role === UserRole.CURATOR && this.curation) await this.curation.assertGroup(lesson.groupId);
    if (
      user.role === UserRole.STUDENT &&
      (!user.groupId || lesson.groupId !== await this.resolveStudentGroupId(user))
    ) {
      throw new ForbiddenException(
        "Students can only access lessons for their own group",
      );
    }
    if (user.role === UserRole.TEACHER && lesson.teacherId !== user.id) {
      throw new ForbiddenException(
        "Teachers can only access their own lessons",
      );
    }
    return lesson;
  }

  private async resolveStudentGroupId(user: {
    organizationId: string;
    groupId?: string | null;
  }): Promise<string | null | undefined> {
    if (!user.groupId || !/^\d+$/.test(user.groupId) || !this.groupRepository) {
      return user.groupId;
    }
    const group = await this.groupRepository.findOne({
      where: { organizationId: user.organizationId, externalId: user.groupId },
    });
    return group?.id;
  }

  async getLessonChanges(
    lessonId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<LessonChange>> {
    await this.findById(lessonId);
    const [data, total] = await this.lessonChangeRepository.findAndCount({
      where: { lessonId },
      order: { createdAt: "DESC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findByDate(
    organizationId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(organizationId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated(
      {
        where: {
          organizationId,
          startDate: Between(startDate, endDate),
        },
        order: { pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findByDateRange(
    organizationId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(organizationId);
    return this.findPaginated(
      {
        where: {
          organizationId,
          startDate: Between(...getInclusiveDateBounds(startDate, endDate)),
        },
        order: { startDate: "ASC", pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findForStudentDateRange(
    organizationId: string,
    groupId: string | null | undefined,
    startDate: string,
    endDate: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
    timeZone?: string,
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(organizationId);
    if (
      groupId &&
      /^\d+$/.test(groupId) &&
      this.raspScraperService
    ) {
      const sourceLessons =
        await this.raspScraperService.getSchedule(groupId);
      const explicitInstants = !!timeZone && startDate.includes("T") && endDate.includes("T");
      const [from, to] = getInclusiveDateBounds(startDate, endDate);
      const lessons = sourceLessons
        .filter((lesson) => explicitInstants || (lesson.date >= startDate.slice(0, 10) && lesson.date <= endDate.slice(0, 10)))
        .map((lesson) => this.mapRaspLesson(lesson, organizationId))
        .filter((lesson) => !explicitInstants || (lesson.startDate >= from && lesson.startDate <= to));
      return this.paginateLessons(lessons, pagination);
    }
    const resolvedGroupId = groupId;
    if (!resolvedGroupId) {
      return toPaginatedResponse([], 0, pagination);
    }
    return this.findPaginated(
      {
        where: {
          organizationId,
          groupId: resolvedGroupId,
          startDate: Between(...getInclusiveDateBounds(startDate, endDate)),
        },
        order: { startDate: "ASC", pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findForStudentDate(
    organizationId: string,
    groupId: string | null | undefined,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(organizationId);
    if (
      groupId &&
      /^\d+$/.test(groupId) &&
      this.raspScraperService
    ) {
      const sourceLessons =
        await this.raspScraperService.getSchedule(groupId);
      const lessons = sourceLessons
        .filter((lesson) => lesson.date === date)
        .map((lesson) => this.mapRaspLesson(lesson, organizationId));
      return this.paginateLessons(lessons, pagination);
    }
    const resolvedGroupId = groupId;
    if (!resolvedGroupId) {
      return toPaginatedResponse([], 0, pagination);
    }
    return this.findByGroup(organizationId, resolvedGroupId, date, pagination);
  }

  private paginateLessons(
    lessons: Lesson[],
    pagination: PaginationQueryDto,
  ): PaginatedResponse<Lesson> {
    const start = (pagination.page - 1) * pagination.limit;
    return toPaginatedResponse(
      lessons.slice(start, start + pagination.limit),
      lessons.length,
      pagination,
    );
  }

  private mapRaspLesson(lesson: RaspLesson, organizationId: string): Lesson & { date: string } {
    const startDate = new Date(`${lesson.date}T${lesson.startTime}:00+06:00`);
    const endDate = new Date(`${lesson.date}T${lesson.endTime}:00+06:00`);
    return {
      id: `rasp-${lesson.lessonId}-${lesson.groupId}`,
      date: lesson.date,
      deletedAt: null,
      organizationId,
      groupId: lesson.groupId,
      courseId: null,
      seriesId: null,
      occurrenceId: null,
      teacherId: lesson.teacherId || "",
      sourceTeacherId: lesson.teacherId || null,
      subject: lesson.subject,
      subjectType: lesson.subjectType || "",
      room: lesson.room || "",
      building: "",
      dayOfWeek: lesson.dayOfWeek,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      pairNumber: lesson.pairNumber,
      weekType: lesson.weekType,
      startDate,
      endDate,
      teacherName: lesson.teacher || "",
      groupName: lesson.groupName,
      subgroup: lesson.subgroup || "",
      department: "",
      faculty: "",
      notes: lesson.isReplacement ? "Замена" : "",
      isChanged: lesson.isReplacement,
      changeDescription: lesson.isReplacement
        ? "Занятие изменено в источнике расписания"
        : "",
      source: "rasp.sano.ru",
      externalId: lesson.lessonId,
      lastSyncedAt: null,
      sourceVersion: null,
      syncStatus: "synced",
      createdAt: startDate,
      updatedAt: startDate,
    };
  }

  async findByGroup(
    organizationId: string,
    groupId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(organizationId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated(
      {
        where: {
          organizationId,
          groupId,
          startDate: Between(startDate, endDate),
        },
        order: { pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findByTeacher(
    organizationId: string,
    teacherId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(organizationId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated(
      {
        where: {
          organizationId,
          teacherId,
          startDate: Between(startDate, endDate),
        },
        order: { pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findByTeacherDateRange(
    organizationId: string,
    teacherId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(organizationId);
    return this.findPaginated(
      {
        where: {
          organizationId,
          teacherId,
          startDate: Between(...getInclusiveDateBounds(startDate, endDate)),
        },
        order: { startDate: "ASC", pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async getTeacherGroupIds(
    organizationId: string,
    teacherId: string,
    academicYear?: string,
  ): Promise<string[]> {
    this.tenantContext.assertAccess(organizationId);
    const yearMatch = academicYear ? /^(\d{4})-(\d{4})$/.exec(academicYear) : null;
    const startYear = yearMatch ? Number(yearMatch[1]) : null;
    const endYear = yearMatch ? Number(yearMatch[2]) : null;
    if (
      academicYear !== undefined &&
      (startYear === null || endYear !== startYear + 1)
    ) {
      throw new BadRequestException("Некорректный учебный год");
    }
    const lessons = await this.lessonRepository.find({
      select: ["groupId"],
      where: {
        organizationId,
        teacherId,
        ...(startYear !== null && endYear !== null
          ? {
              startDate: And(
                MoreThanOrEqual(new Date(Date.UTC(startYear, 8, 1))),
                LessThan(new Date(Date.UTC(endYear, 8, 1))),
              ),
            }
          : {}),
      },
    });
    return [
      ...new Set(lessons.map((lesson) => lesson.groupId).filter(Boolean)),
    ];
  }

  async create(
    createLessonDto: CreateLessonDto,
    options: { skipConflictCheck?: boolean } = {},
  ): Promise<Lesson> {
    if (createLessonDto.organizationId) {
      this.tenantContext.assertAccess(createLessonDto.organizationId);
    }
    const actor = this.tenantContext.getUser();
    if (actor?.role === UserRole.CURATOR) throw new ForbiddenException('Кураторство не даёт права изменять расписание.');
    if (
      actor?.role === UserRole.TEACHER &&
      createLessonDto.teacherId &&
      createLessonDto.teacherId !== actor.id
    ) {
      throw new ForbiddenException(
        "Teachers can only create lessons for themselves",
      );
    }
    await this.assertLessonReferences(createLessonDto.organizationId, createLessonDto.groupId, createLessonDto.teacherId);
    if (!options.skipConflictCheck) {
      await this.assertNoScheduleConflicts({
        ...createLessonDto,
        teacherId: createLessonDto.teacherId ?? actor?.id ?? null,
      });
    }
    const lesson = this.lessonRepository.create({
      ...createLessonDto,
      ...(actor?.role === UserRole.TEACHER ? { teacherId: actor.id } : {}),
      source: createLessonDto.source ?? "manual",
      lastSyncedAt: createLessonDto.source ? new Date() : null,
      syncStatus: createLessonDto.source ? "synced" : "unknown",
    });
    return this.lessonRepository.save(lesson);
  }

  async update(
    id: string,
    updateLessonDto: UpdateLessonDto,
    options: { skipConflictCheck?: boolean } = {},
  ): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    this.tenantContext.assertAccess(lesson.organizationId);
    const dispatcher = await this.assertTeacherCanManageLesson(lesson, updateLessonDto.groupId, true);
    if (dispatcher) {
      const allowed = new Set(['room', 'building', 'startDate', 'endDate', 'startTime', 'endTime', 'isChanged', 'changeDescription']);
      if (Object.keys(updateLessonDto).some(key => !allowed.has(key))) throw new ForbiddenException('Диспетчер меняет время и место занятия, без переноса группы, источника или преподавателя.');
      if (!updateLessonDto.changeDescription?.trim()) throw new ForbiddenException('Диспетчер указывает основание изменения.');
      if (updateLessonDto.changeDescription.length > 1000 || (updateLessonDto.room?.length ?? 0) > 100 || (updateLessonDto.building?.length ?? 0) > 100) throw new ForbiddenException('Сократите основание, аудиторию или корпус.');
      for (const key of ['startDate', 'endDate', 'startTime', 'endTime'] as const) if (key in updateLessonDto && updateLessonDto[key] == null) throw new ForbiddenException('Время и даты занятия нельзя очищать.');
      updateLessonDto.isChanged = true;
      const start = new Date(updateLessonDto.startDate ?? lesson.startDate).getTime(), end = new Date(updateLessonDto.endDate ?? lesson.endDate).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86400000) throw new ForbiddenException('Проверьте начало и окончание занятия.');
      for (const time of [updateLessonDto.startTime, updateLessonDto.endTime]) if (time !== undefined && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ForbiddenException('Время указывается в формате ЧЧ:ММ.');
    }
    if (updateLessonDto.organizationId !== undefined && updateLessonDto.organizationId !== lesson.organizationId) {
      throw new ForbiddenException('Перенос занятия в другой университет запрещён');
    }
    await this.assertLessonReferences(lesson.organizationId, updateLessonDto.groupId, updateLessonDto.teacherId);

    const oldValue = lessonChangeValues(lesson);
    Object.assign(lesson, updateLessonDto);
    if (!options.skipConflictCheck) await this.assertNoScheduleConflicts(lesson, lesson.id);

    const actor = this.tenantContext.getUser();
    const updatedLesson = await this.dataSource.transaction(async (manager) => {
      const savedLesson = await manager.getRepository(Lesson).save(lesson);
      await manager.getRepository(LessonChange).save({
        lessonId: lesson.id,
        changeType: lessonChangeType(oldValue, lessonChangeValues(lesson)),
        oldValues: oldValue,
        newValues: lessonChangeValues(savedLesson),
        changedBy: actor?.id ?? null,
        reason: updateLessonDto.changeDescription ?? "Lesson updated",
        source: updateLessonDto.source ?? "manual",
      });

      if (
        lesson.occurrenceId &&
        this.occurrenceRepository &&
        this.academicChangeRepository
      ) {
        const occurrence = await manager
          .getRepository(LessonOccurrence)
          .findOne({ where: { id: lesson.occurrenceId } });
        if (occurrence) {
          const occurrenceOriginal = occurrenceSnapshot(occurrence);
          Object.assign(occurrence, {
            room: savedLesson.room,
            building: savedLesson.building,
            startsAt: savedLesson.startDate,
            endsAt: savedLesson.endDate,
            status: savedLesson.isChanged ? "rescheduled" : occurrence.status,
            changeReason: savedLesson.changeDescription,
          });
          const occurrenceUpdated = await manager
            .getRepository(LessonOccurrence)
            .save(occurrence);
          await manager.getRepository(ScheduleChange).save({
            organizationId: occurrenceUpdated.organizationId,
            occurrenceId: occurrenceUpdated.id,
            legacyLessonId: lesson.id,
            originalValue: occurrenceOriginal,
            newValue: occurrenceSnapshot(occurrenceUpdated),
            reason:
              updateLessonDto.changeDescription ?? "Legacy lesson updated",
            actorId: actor?.id ?? null,
            source: updateLessonDto.source ?? "legacy",
            timestamp: new Date(),
          });
        }
      }

      return savedLesson;
    });

    // Emit change event
    this.eventEmitter.emit("lesson.changed", {
      organizationId: lesson.organizationId,
      lessonId: lesson.id,
      oldValue,
      newValue: updatedLesson,
    });

    const updatedValues = lessonChangeValues(updatedLesson);
    const roomChanged = oldValue.room !== updatedValues.room || oldValue.building !== updatedValues.building;
    const timeChanged = oldValue.startDate !== updatedValues.startDate
      || oldValue.endDate !== updatedValues.endDate
      || oldValue.startTime !== updatedValues.startTime
      || oldValue.endTime !== updatedValues.endTime;
    const eventType = roomChanged
      ? "room.changed"
      : timeChanged
        ? "lesson.rescheduled"
        : "lesson.changed";
    await this.eventBus?.publish({
      type: eventType,
      organizationId: lesson.organizationId,
      actor: this.eventActor(),
      target: { type: "lesson", id: lesson.id },
      payload: {
        subject: updatedLesson.subject,
        oldValue,
        newValue: updatedValues,
        groupId: lesson.groupId,
        teacherId: lesson.teacherId,
        deepLink: `/pair-space/${lesson.id}`,
      },
      priority: eventType === "lesson.changed" ? "normal" : "high",
    });

    return updatedLesson;
  }

  async delete(id: string): Promise<void> {
    const lesson = await this.findById(id);
    await this.assertTeacherCanManageLesson(lesson);
    await this.lessonRepository.delete(lesson.id);
    await this.eventBus?.publish({
      type: "lesson.cancelled",
      organizationId: lesson.organizationId,
      actor: this.eventActor(),
      target: { type: "lesson", id: lesson.id },
      payload: {
        subject: lesson.subject,
        oldValue: lessonChangeValues(lesson),
        groupId: lesson.groupId,
        teacherId: lesson.teacherId,
        deepLink: `/week?date=${lesson.startDate.toISOString().slice(0, 10)}`,
      },
      priority: "high",
    });
  }

  /**
   * Server-side schedule conflicts. The client may warn, but only this check
   * decides whether a lesson can be stored.
   */
  async findConflicts(
    candidate: ScheduleCandidate,
    excludeId?: string,
  ): Promise<ScheduleConflict[]> {
    const organizationId = candidate.organizationId;
    if (!organizationId) return [];
    const startDate = new Date(candidate.startDate);
    const endDate = new Date(candidate.endDate);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return [];
    if (!candidate.startTime || !candidate.endTime || candidate.startTime >= candidate.endTime) return [];
    // Without a weekday every weekly row would match, so a check must not guess.
    if (candidate.dayOfWeek == null) return [];
    const rows = await this.lessonRepository.find({
      where: {
        organizationId,
        dayOfWeek: candidate.dayOfWeek,
        startDate: LessThanOrEqual(endOfDay(endDate)),
        endDate: MoreThanOrEqual(startOfDay(startDate)),
        startTime: LessThan(candidate.endTime),
        endTime: MoreThan(candidate.startTime),
      },
    });
    const candidateWeek = candidate.weekType ?? "both";
    const candidateRoom = candidate.room?.trim().toLowerCase();
    const conflicts: ScheduleConflict[] = [];
    for (const row of rows) {
      if (row.id === excludeId) continue;
      const rowWeek = row.weekType ?? "both";
      if (candidateWeek !== "both" && rowWeek !== "both" && candidateWeek !== rowWeek) continue;
      const types: ScheduleConflictType[] = [];
      if (candidate.teacherId && row.teacherId === candidate.teacherId) types.push("teacher");
      if (candidate.groupId && row.groupId === candidate.groupId) types.push("group");
      if (candidateRoom && row.room?.trim().toLowerCase() === candidateRoom) types.push("room");
      for (const type of types) {
        conflicts.push({
          type,
          lessonId: row.id,
          subject: row.subject,
          dayOfWeek: row.dayOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          dateFrom: toDateKey(row.startDate),
          dateTo: toDateKey(row.endDate),
          groupId: row.groupId ?? null,
          groupName: row.groupName ?? null,
          teacherId: row.teacherId ?? null,
          teacherName: row.teacherName ?? null,
          room: row.room ?? null,
        });
      }
    }
    return conflicts;
  }

  private async assertNoScheduleConflicts(
    candidate: ScheduleCandidate,
    excludeId?: string,
  ): Promise<void> {
    const conflicts = await this.findConflicts(candidate, excludeId);
    if (!conflicts.length) return;
    throw new ConflictException({
      code: "SCHEDULE_CONFLICT",
      message: `Конфликт расписания: ${conflicts.map(describeScheduleConflict).join("; ")}`,
      conflicts,
    });
  }

  async assertLessonReferences(organizationId: string | undefined, groupId?: string, teacherId?: string): Promise<void> {
    // Background imports resolve their references separately. HTTP mutations
    // must never attach an own-university row to a foreign group or teacher.
    if (!this.tenantContext.getUser()) return;
    if (!organizationId) throw new ForbiddenException('Для занятия необходим университет');
    if (groupId) {
      const group = this.groupRepository && await this.groupRepository.findOne({ where: { id: groupId, organizationId, archivedAt: IsNull() } });
      if (!group || !await this.dataSource.getRepository(Faculty).existsBy({ id: group.facultyId, organizationId, archivedAt: IsNull() })) throw new NotFoundException('Группа своего университета не найдена');
    }
    if (teacherId && !await this.dataSource.getRepository(User).findOne({ where: { id: teacherId, organizationId } })) {
      throw new NotFoundException('Преподаватель своего университета не найден');
    }
  }

  private async assertTeacherCanManageLesson(lesson: Lesson, targetGroupId?: string, allowDispatcher = false): Promise<boolean> {
    const user = this.tenantContext.getUser();
    if (allowDispatcher && user && (user.role === UserRole.CURATOR || user.role === UserRole.TEACHER && lesson.teacherId !== user.id) && this.dataSource.hasMetadata?.(OfficeAssignment)) {
      const grants = await this.dataSource.getRepository(OfficeAssignment).findBy({ organizationId: lesson.organizationId, userId: user.id, duty: 'dispatcher', revokedAt: IsNull() });
      const groups = await this.dataSource.getRepository(Group).findBy({ organizationId: lesson.organizationId, id: In([...new Set([lesson.groupId, ...(targetGroupId ? [targetGroupId] : [])])]) });
      if (groups.some(group => group.id === lesson.groupId) && (!targetGroupId || groups.some(group => group.id === targetGroupId)) && groups.every(group => grants.some(grant => grant.groupIds.includes(group.id) || grant.facultyIds.includes(group.facultyId)))) return true;
    }
    if (user?.role === UserRole.CURATOR) throw new ForbiddenException('Кураторство не даёт права изменять расписание.');
    if (user?.role === UserRole.TEACHER && lesson.teacherId !== user.id) {
      throw new ForbiddenException(
        "Teachers can only manage their own lessons",
      );
    }
    return false;
  }

  async importLessons(
    organizationId: string,
    lessons: CreateLessonDto[],
  ): Promise<{ imported: number; updated: number }> {
    this.tenantContext.assertAccess(organizationId);
    let imported = 0;
    let updated = 0;

    try {
      for (const lessonData of lessons) {
        const existingLesson = await this.lessonRepository.findOne({
          where: {
            organizationId,
            groupId: lessonData.groupId,
            dayOfWeek: lessonData.dayOfWeek,
            pairNumber: lessonData.pairNumber,
          },
        });

        if (existingLesson) {
          await this.update(existingLesson.id, lessonData, { skipConflictCheck: true });
          updated++;
        } else {
          await this.create({ ...lessonData, organizationId }, { skipConflictCheck: true });
          imported++;
        }
      }
    } catch (error) {
      await this.eventBus?.publish({
        type: "sync.failed",
        organizationId,
        actor: this.eventActor(),
        target: { type: "schedule", id: organizationId },
        payload: {
          message:
            error instanceof Error ? error.message : "Schedule import failed",
        },
        priority: "urgent",
      });
      throw error;
    }

    this.logger.log(
      `Imported ${imported} lessons, updated ${updated} lessons for university ${organizationId}`,
    );

    const result = { imported, updated };
    await this.eventBus?.publish({
      type: "sync.completed",
      organizationId,
      actor: this.eventActor(),
      target: { type: "schedule", id: organizationId },
      payload: result,
      priority: "normal",
    });
    return result;
  }

  async getChangedLessons(
    organizationId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(organizationId);
    const { startDate, endDate } = getDayRange(date);

    const actor = this.tenantContext.getUser();
    if (actor?.role === UserRole.STUDENT) {
      if (!actor.groupId) return toPaginatedResponse([], 0, pagination);
      if (/^\d+$/.test(actor.groupId) && this.raspScraperService) {
        const lessons = await this.raspScraperService.getSchedule(actor.groupId);
        return this.paginateLessons(
          lessons.filter(lesson => lesson.date === date && lesson.isReplacement)
            .map(lesson => this.mapRaspLesson(lesson, organizationId)),
          pagination,
        );
      }
    }

    return this.findPaginated(
      {
        where: {
          organizationId,
          startDate: Between(startDate, endDate),
          isChanged: true,
          ...(actor?.role === UserRole.STUDENT ? { groupId: actor.groupId! } : {}),
          ...(actor?.role === UserRole.TEACHER ? { teacherId: actor.id } : {}),
        },
        order: { pairNumber: "ASC" },
      },
      pagination,
    );
  }

  private async findPaginated(
    options: FindManyOptions<Lesson>,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Lesson>> {
    if (this.tenantContext.getUser()?.role === UserRole.CURATOR && this.curation) {
      const groupIds = await this.curation.assignedGroupIds();
      const where = Array.isArray(options.where) ? options.where : [options.where || {}];
      options = { ...options, where: where.map(item => ({ ...item, groupId: item.groupId ? And(typeof item.groupId === 'string' ? Equal(item.groupId) : item.groupId, In(groupIds)) : In(groupIds) })) };
    }
    const [data, total] = await this.lessonRepository.findAndCount({
      ...options,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  private eventActor() {
    const user = this.tenantContext.getUser();
    return user
      ? { id: user.id, type: "user" as const, role: user.role }
      : { type: "system" as const };
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
    startDate: new Date(lesson.startDate).toISOString(),
    endDate: new Date(lesson.endDate).toISOString(),
  };
}

function lessonChangeType(oldValues: JsonObject, newValues: JsonObject): string {
  const changed = (...keys: string[]) => keys.some((key) => oldValues[key] !== newValues[key]);
  if (changed("room", "building")) return "room_changed";
  if (changed("teacherId", "teacherName")) return "teacher_changed";
  if (changed("startDate", "endDate", "startTime", "endTime")) return "moved";
  return "updated";
}

function occurrenceSnapshot(occurrence: LessonOccurrence): JsonObject {
  return {
    id: occurrence.id,
    startsAt: occurrence.startsAt.toISOString(),
    endsAt: occurrence.endsAt.toISOString(),
    room: occurrence.room,
    building: occurrence.building,
    status: occurrence.status,
    changeReason: occurrence.changeReason,
  };
}
