import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, FindManyOptions, Repository, Between, In, And, Equal } from "typeorm";
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
import { UserRole } from "../auth/interfaces/user-role";
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from "../common/dto/pagination-query.dto";

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
  ) {}

  async findById(id: string): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    this.tenantContext.assertAccess(lesson.universityId);
    if (this.tenantContext.getUser()?.role === UserRole.CURATOR && this.curation) await this.curation.assertGroup(lesson.groupId);

    return lesson;
  }

  async findAccessibleById(
    id: string,
    user: {
      id: string;
      universityId: string;
      role: UserRole;
      groupId?: string | null;
    },
  ): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({
      where: { id, universityId: user.universityId },
    });
    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    if (user.role === UserRole.CURATOR && this.curation) await this.curation.assertGroup(lesson.groupId);
    if (
      user.role === UserRole.STUDENT &&
      (!user.groupId || lesson.groupId !== user.groupId)
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
    universityId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated(
      {
        where: {
          universityId,
          startDate: Between(startDate, endDate),
        },
        order: { pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findByDateRange(
    universityId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    return this.findPaginated(
      {
        where: {
          universityId,
          startDate: Between(...getInclusiveDateBounds(startDate, endDate)),
        },
        order: { startDate: "ASC", pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findForStudentDateRange(
    universityId: string,
    groupId: string | null | undefined,
    startDate: string,
    endDate: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
    timeZone?: string,
  ): Promise<PaginatedResponse<Lesson>> {
    const resolvedGroupId = await this.resolveStudentGroupId(
      universityId,
      groupId,
    );
    if (
      resolvedGroupId &&
      /^\d+$/.test(resolvedGroupId) &&
      this.raspScraperService
    ) {
      const sourceLessons =
        await this.raspScraperService.getSchedule(resolvedGroupId);
      const startDateKey = this.getCalendarDateKey(startDate, timeZone);
      const endDateKey = this.getCalendarDateKey(endDate, timeZone);
      const lessons = sourceLessons
        .filter((lesson) => lesson.date >= startDateKey && lesson.date <= endDateKey)
        .map((lesson) => this.mapRaspLesson(lesson, universityId));
      return toPaginatedResponse(lessons, lessons.length, pagination);
    }
    if (!resolvedGroupId) {
      return toPaginatedResponse([], 0, pagination);
    }
    return this.findPaginated(
      {
        where: {
          universityId,
          groupId: resolvedGroupId,
          startDate: Between(...getInclusiveDateBounds(startDate, endDate)),
        },
        order: { startDate: "ASC", pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findForStudentDate(
    universityId: string,
    groupId: string | null | undefined,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    const resolvedGroupId = await this.resolveStudentGroupId(
      universityId,
      groupId,
    );
    if (
      resolvedGroupId &&
      /^\d+$/.test(resolvedGroupId) &&
      this.raspScraperService
    ) {
      const sourceLessons =
        await this.raspScraperService.getSchedule(resolvedGroupId);
      const lessons = sourceLessons
        .filter((lesson) => lesson.date === date)
        .map((lesson) => this.mapRaspLesson(lesson, universityId));
      return toPaginatedResponse(lessons, lessons.length, pagination);
    }
    if (!resolvedGroupId) {
      return toPaginatedResponse([], 0, pagination);
    }
    return this.findByGroup(universityId, resolvedGroupId, date, pagination);
  }

  /**
   * Students who registered before a SIBIT sync can still carry the numeric
   * source id in an unexpired token. Resolve it to the imported local group so
   * downstream actions receive persisted lesson UUIDs immediately.
   */
  private async resolveStudentGroupId(
    universityId: string,
    groupId: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (!groupId || !/^\d+$/.test(groupId) || !this.groupRepository) {
      return groupId;
    }
    const group = await this.groupRepository.findOne({
      where: { universityId, externalId: groupId },
    });
    return group?.id ?? groupId;
  }

  private getCalendarDateKey(value: string, timeZone?: string): string {
    if (!timeZone) return value.slice(0, 10);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  private mapRaspLesson(lesson: RaspLesson, universityId: string): Lesson {
    const startDate = new Date(`${lesson.date}T${lesson.startTime}:00`);
    const endDate = new Date(`${lesson.date}T${lesson.endTime}:00`);
    return {
      id: `rasp-${lesson.lessonId}-${lesson.groupId}`,
      universityId,
      groupId: lesson.groupId,
      courseId: null,
      seriesId: null,
      occurrenceId: null,
      teacherId: lesson.teacherId || "",
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
    universityId: string,
    groupId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated(
      {
        where: {
          universityId,
          groupId,
          startDate: Between(startDate, endDate),
        },
        order: { pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findByTeacher(
    universityId: string,
    teacherId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated(
      {
        where: {
          universityId,
          teacherId,
          startDate: Between(startDate, endDate),
        },
        order: { pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async findByTeacherDateRange(
    universityId: string,
    teacherId: string,
    startDate: string,
    endDate: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    return this.findPaginated(
      {
        where: {
          universityId,
          teacherId,
          startDate: Between(...getInclusiveDateBounds(startDate, endDate)),
        },
        order: { startDate: "ASC", pairNumber: "ASC" },
      },
      pagination,
    );
  }

  async getTeacherGroupIds(
    universityId: string,
    teacherId: string,
  ): Promise<string[]> {
    this.tenantContext.assertAccess(universityId);
    const lessons = await this.lessonRepository.find({
      select: ["groupId"],
      where: { universityId, teacherId },
    });
    return [
      ...new Set(lessons.map((lesson) => lesson.groupId).filter(Boolean)),
    ];
  }

  async create(createLessonDto: CreateLessonDto): Promise<Lesson> {
    if (createLessonDto.universityId) {
      this.tenantContext.assertAccess(createLessonDto.universityId);
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
    const lesson = this.lessonRepository.create({
      ...createLessonDto,
      ...(actor?.role === UserRole.TEACHER ? { teacherId: actor.id } : {}),
      source: createLessonDto.source ?? "manual",
      lastSyncedAt: createLessonDto.source ? new Date() : null,
      syncStatus: createLessonDto.source ? "synced" : "unknown",
    });
    return this.lessonRepository.save(lesson);
  }

  async update(id: string, updateLessonDto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.lessonRepository.findOne({ where: { id } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id ${id} not found`);
    }
    this.tenantContext.assertAccess(lesson.universityId);
    this.assertTeacherCanManageLesson(lesson);

    const oldValue = lessonChangeValues(lesson);
    Object.assign(lesson, updateLessonDto);

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
            universityId: occurrenceUpdated.universityId,
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
      universityId: lesson.universityId,
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
      universityId: lesson.universityId,
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
    this.assertTeacherCanManageLesson(lesson);
    await this.lessonRepository.delete(lesson.id);
    await this.eventBus?.publish({
      type: "lesson.cancelled",
      universityId: lesson.universityId,
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

  private assertTeacherCanManageLesson(lesson: Lesson): void {
    const user = this.tenantContext.getUser();
    if (user?.role === UserRole.CURATOR) throw new ForbiddenException('Кураторство не даёт права изменять расписание.');
    if (user?.role === UserRole.TEACHER && lesson.teacherId !== user.id) {
      throw new ForbiddenException(
        "Teachers can only manage their own lessons",
      );
    }
  }

  async importLessons(
    universityId: string,
    lessons: CreateLessonDto[],
  ): Promise<{ imported: number; updated: number }> {
    this.tenantContext.assertAccess(universityId);
    let imported = 0;
    let updated = 0;

    try {
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
    } catch (error) {
      await this.eventBus?.publish({
        type: "sync.failed",
        universityId,
        actor: this.eventActor(),
        target: { type: "schedule", id: universityId },
        payload: {
          message:
            error instanceof Error ? error.message : "Schedule import failed",
        },
        priority: "urgent",
      });
      throw error;
    }

    this.logger.log(
      `Imported ${imported} lessons, updated ${updated} lessons for university ${universityId}`,
    );

    const result = { imported, updated };
    await this.eventBus?.publish({
      type: "sync.completed",
      universityId,
      actor: this.eventActor(),
      target: { type: "schedule", id: universityId },
      payload: result,
      priority: "normal",
    });
    return result;
  }

  async getChangedLessons(
    universityId: string,
    date: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedResponse<Lesson>> {
    this.tenantContext.assertAccess(universityId);
    const { startDate, endDate } = getDayRange(date);

    return this.findPaginated(
      {
        where: {
          universityId,
          startDate: Between(startDate, endDate),
          isChanged: true,
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
