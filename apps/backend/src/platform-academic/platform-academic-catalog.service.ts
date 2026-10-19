import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { PaginationQueryDto, toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { AuditLog } from '../common/entities/audit-log.entity';
import { TenantContext } from '../common/tenant/tenant-context';
import { JsonObject } from '../common/types/json-value.type';
import { Course } from '../academic/entities/course.entity';
import { CourseSpace } from '../academic/entities/course-space.entity';
import { LessonOccurrence } from '../academic/entities/lesson-occurrence.entity';
import { LessonSeries } from '../academic/entities/lesson-series.entity';
import { Faculty } from '../users/entities/faculty.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformService } from '../platform/platform.service';
import {
  PlatformAcademicCatalogQueryDto,
  PlatformAcademicCoursePatchDto,
  PlatformAcademicSeriesPatchDto,
} from './platform-academic-catalog.dto';

type AuditContext = { ip?: string; userAgent?: string };
type CourseContext = { course: Course; university: University; faculty: Faculty | null };
type SeriesContext = {
  series: LessonSeries;
  university: University;
  course: Course;
  group: Group | null;
  teacher: User | null;
};

const COURSE_AUDIT_ACTIONS = ['platform.academic_course.viewed', 'platform.academic_course.updated'];
const SERIES_AUDIT_ACTIONS = ['platform.academic_series.viewed', 'platform.academic_series.updated'];
const SERIES_SNAPSHOT_NOTICE = 'Изменяется шаблон серии. Уже созданные занятия (occurrences) сохраняют свои значения и не обновляются этой операцией.';

@Injectable()
export class PlatformAcademicCatalogService {
  constructor(
    private readonly db: DataSource,
    private readonly platform: PlatformService,
    private readonly tenant: TenantContext,
  ) {}

  async options(universityId: string) {
    const access = await this.platform.require('academic-data.read');
    this.platform.assertUniversityScope(access, universityId);
    const university = await this.db.getRepository(University).findOne({ where: { id: universityId }, select: ['id'] });
    if (!university) throw new NotFoundException('Университет не найден.');
    const [faculties, groups, teachers] = await Promise.all([
      this.db.getRepository(Faculty).createQueryBuilder('f').select(['f.id', 'f.name']).where('f.universityId = :universityId', { universityId }).orderBy('f.name', 'ASC').getMany(),
      this.db.getRepository(Group).createQueryBuilder('g').select(['g.id', 'g.name']).where('g.universityId = :universityId', { universityId }).orderBy('g.name', 'ASC').getMany(),
      this.db.getRepository(User).createQueryBuilder('u').select(['u.id', 'u.firstName', 'u.lastName']).where('u.universityId = :universityId AND u.role = :role AND u.isActive = true', { universityId, role: UserRole.TEACHER }).orderBy('u.lastName', 'ASC').addOrderBy('u.firstName', 'ASC').getMany(),
    ]);
    return { faculties, groups, teachers: teachers.map(user => ({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim() })) };
  }

  async listCourses(query: PlatformAcademicCatalogQueryDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.read');
    const qb = this.db.getRepository(Course).createQueryBuilder('c')
      .leftJoin(University, 'u', 'u.id = c.universityId')
      .leftJoin(Faculty, 'f', 'f.id = c.facultyId AND f.universityId = c.universityId')
      .addSelect('u.name', 'catalog_university_name')
      .addSelect('f.name', 'catalog_faculty_name');
    if (query.universityId) {
      this.platform.assertUniversityScope(access, query.universityId);
      qb.andWhere('c.universityId = :universityId', { universityId: query.universityId });
    }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('c.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    this.applySearch(qb, query.q, "c.id::text ILIKE :q ESCAPE E'\\\\' OR c.code ILIKE :q ESCAPE E'\\\\' OR c.name ILIKE :q ESCAPE E'\\\\' OR c.facultyId::text ILIKE :q ESCAPE E'\\\\' OR f.name ILIKE :q ESCAPE E'\\\\' OR u.name ILIKE :q ESCAPE E'\\\\'");
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('c.name', 'ASC').addOrderBy('c.code', 'ASC').addOrderBy('c.id', 'ASC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawAndEntities();
    const data = rows.entities.map((course, index) => this.courseListItem(course, rows.raw[index]));
    await this.db.getRepository(AuditLog).save({
      userId: access.actorId,
      action: 'platform.academic_course.search',
      entity: 'academic_course_search',
      entityId: 'search',
      newValues: { queryEntered: Boolean(query.q?.trim()), universityId: query.universityId ?? null, page: query.page, limit: query.limit, resultCount: data.length, total, resultIds: data.map(item => item.id) },
      ...this.auditContext(auditContext),
    });
    return toPaginatedResponse(data, total, query);
  }

  async listSeries(query: PlatformAcademicCatalogQueryDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.read');
    const qb = this.db.getRepository(LessonSeries).createQueryBuilder('s')
      .leftJoin(University, 'u', 'u.id = s.universityId')
      .leftJoin(Course, 'c', 'c.id = s.courseId AND c.universityId = s.universityId')
      .leftJoin(Group, 'g', 'g.id = s.groupId AND g.universityId = s.universityId')
      .leftJoin(User, 't', 't.id = s.teacherId AND t.universityId = s.universityId')
      .addSelect('u.name', 'catalog_university_name')
      .addSelect('c.name', 'catalog_course_name')
      .addSelect('c.code', 'catalog_course_code')
      .addSelect('g.name', 'catalog_group_name')
      .addSelect("concat_ws(' ', t.firstName, t.lastName)", 'catalog_teacher_name');
    if (query.universityId) {
      this.platform.assertUniversityScope(access, query.universityId);
      qb.andWhere('s.universityId = :universityId', { universityId: query.universityId });
    }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('s.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    this.applySearch(qb, query.q, "s.id::text ILIKE :q ESCAPE E'\\\\' OR s.courseId::text ILIKE :q ESCAPE E'\\\\' OR s.groupId::text ILIKE :q ESCAPE E'\\\\' OR s.teacherId::text ILIKE :q ESCAPE E'\\\\' OR s.title ILIKE :q ESCAPE E'\\\\' OR s.subjectType ILIKE :q ESCAPE E'\\\\' OR c.name ILIKE :q ESCAPE E'\\\\' OR c.code ILIKE :q ESCAPE E'\\\\' OR g.name ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', t.firstName, t.lastName) ILIKE :q ESCAPE E'\\\\' OR u.name ILIKE :q ESCAPE E'\\\\'");
    const total = await qb.clone().getCount();
    const rows = await qb.orderBy('s.validFrom', 'DESC').addOrderBy('s.dayOfWeek', 'ASC').addOrderBy('s.pairNumber', 'ASC').addOrderBy('s.id', 'ASC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawAndEntities();
    const data = rows.entities.map((series, index) => this.seriesListItem(series, rows.raw[index]));
    await this.db.getRepository(AuditLog).save({
      userId: access.actorId,
      action: 'platform.academic_series.search',
      entity: 'academic_series_search',
      entityId: 'search',
      newValues: { queryEntered: Boolean(query.q?.trim()), universityId: query.universityId ?? null, page: query.page, limit: query.limit, resultCount: data.length, total, resultIds: data.map(item => item.id) },
      ...this.auditContext(auditContext),
    });
    return toPaginatedResponse(data, total, query);
  }

  async getCourse(id: string, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.read');
    const context = await this.courseContext(this.db.manager, id, true);
    this.platform.assertUniversityScope(access, context.course.universityId);
    const history = await this.db.getRepository(AuditLog).find({
      where: { entity: 'academic_course', entityId: id, action: In(COURSE_AUDIT_ACTIONS) },
      order: { createdAt: 'DESC', id: 'DESC' }, take: 20,
    });
    await this.db.getRepository(AuditLog).save({
      userId: access.actorId, action: 'platform.academic_course.viewed', entity: 'academic_course', entityId: id,
      newValues: { universityId: context.course.universityId, facultyId: context.course.facultyId, result: 'viewed' },
      ...this.auditContext(auditContext),
    });
    return {
      ...this.courseListItem(context.course, { university_name: context.university.name, faculty_name: context.faculty?.name ?? null }),
      relationshipWarnings: context.course.facultyId && !context.faculty ? ['Факультет не найден в этом вузе. Выберите корректный факультет или очистите связь перед сохранением изменений.'] : [],
      history: history.map(entry => this.historyItem(entry)),
    };
  }

  async getSeries(id: string, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.read');
    const context = await this.seriesContext(this.db.manager, id, { allowGroupMismatch: true, allowTeacherMismatch: true });
    this.platform.assertUniversityScope(access, context.series.universityId);
    const [history, existingOccurrencesCount] = await Promise.all([
      this.db.getRepository(AuditLog).find({
        where: { entity: 'academic_series', entityId: id, action: In(SERIES_AUDIT_ACTIONS) },
        order: { createdAt: 'DESC', id: 'DESC' }, take: 20,
      }),
      this.db.getRepository(LessonOccurrence).count({ where: { seriesId: id } }),
    ]);
    await this.db.getRepository(AuditLog).save({
      userId: access.actorId, action: 'platform.academic_series.viewed', entity: 'academic_series', entityId: id,
      newValues: { universityId: context.series.universityId, courseId: context.series.courseId, groupId: context.series.groupId, teacherId: context.series.teacherId, result: 'viewed' },
      ...this.auditContext(auditContext),
    });
    return {
      ...this.seriesListItem(context.series, {
        university_name: context.university.name,
        course_name: context.course.name,
        course_code: context.course.code,
        group_name: context.group?.name ?? null,
        teacher_name: context.teacher ? `${context.teacher.firstName} ${context.teacher.lastName}`.trim() : null,
      }),
      existingOccurrencesCount,
      occurrenceUpdateNotice: SERIES_SNAPSHOT_NOTICE,
      relationshipWarnings: [
        ...(context.group ? [] : ['Группа не найдена в этом вузе. Выберите группу этого же вуза перед сохранением изменений.']),
        ...(context.series.teacherId && !context.teacher ? ['Преподаватель не найден в этом вузе или не имеет роли преподавателя. Выберите корректного преподавателя или очистите связь перед сохранением изменений.'] : []),
      ],
      history: history.map(entry => this.historyItem(entry)),
    };
  }

  async patchCourse(id: string, dto: PlatformAcademicCoursePatchDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.write');
    const actor = this.tenant.getUser();
    if (!actor) throw new ForbiddenException('Не удалось определить пользователя, выполнившего изменение.');
    const reason = this.requireReason(dto.reason);
    const editable = ['code', 'name', 'facultyId', 'description', 'credits', 'isActive'] as const;
    if (!editable.some(field => dto[field] !== undefined)) throw new BadRequestException('Укажите хотя бы одно поле курса для изменения.');

    try {
      const saved = await this.db.transaction(async manager => {
        const courseRepo = manager.getRepository(Course);
        const course = await courseRepo.createQueryBuilder('c').setLock('pessimistic_write').where('c.id = :id', { id }).getOne();
        if (!course) throw new NotFoundException('Курс каталога не найден.');
        this.platform.assertUniversityScope(access, course.universityId);
        if (course.source !== 'manual') throw new ConflictException('Курс получен из внешнего источника и доступен только для просмотра. Исправьте его в источнике синхронизации.');
        const context = await this.courseContext(manager, id, dto.facultyId !== undefined);
        const oldValues = this.courseSnapshot(course);

        if (dto.facultyId !== undefined) {
          if (dto.facultyId === null) course.facultyId = null;
          else {
            const faculty = await manager.getRepository(Faculty).findOne({ where: { id: dto.facultyId, universityId: course.universityId } });
            if (!faculty) throw new BadRequestException('Факультет должен принадлежать тому же вузу, что и курс.');
            course.facultyId = faculty.id;
          }
        }
        if (dto.code !== undefined) course.code = this.requireNonBlank(dto.code, 'Код курса');
        if (dto.name !== undefined) course.name = this.requireNonBlank(dto.name, 'Название курса');
        if (dto.description !== undefined) course.description = this.cleanNullable(dto.description);
        if (dto.credits !== undefined) course.credits = dto.credits;
        if (dto.isActive !== undefined) course.isActive = dto.isActive;

        const updated = await courseRepo.save(course);
        if (updated.name !== oldValues.name || updated.isActive !== oldValues.isActive) {
          const spaceRepo = manager.getRepository(CourseSpace);
          const space = await spaceRepo.findOne({ where: { courseId: updated.id, universityId: updated.universityId }, lock: { mode: 'pessimistic_write' } });
          if (!space) throw new ConflictException('Для курса не найдена связанная Course Space. Изменение отменено, чтобы не рассинхронизировать данные.');
          if (updated.name !== oldValues.name) space.name = updated.name;
          if (updated.isActive !== oldValues.isActive) space.isActive = updated.isActive;
          await spaceRepo.save(space);
        }
        const newValues = this.courseSnapshot(updated);
        await manager.getRepository(AuditLog).save({
          userId: access.actorId, action: 'platform.academic_course.updated', entity: 'academic_course', entityId: updated.id,
          oldValues: { ...oldValues, universityId: context.course.universityId },
          newValues: { ...newValues, universityId: context.course.universityId, reason },
          ...this.auditContext(auditContext),
        });
        return updated;
      });
      return this.getCourseAfterWrite(saved.id);
    } catch (error) {
      if (isUniqueConflict(error)) throw new ConflictException('Курс с таким кодом уже существует в этом вузе.');
      throw error;
    }
  }

  async patchSeries(id: string, dto: PlatformAcademicSeriesPatchDto, auditContext: AuditContext = {}) {
    const access = await this.platform.require('academic-data.write');
    if (!this.tenant.getUser()) throw new ForbiddenException('Не удалось определить пользователя, выполнившего изменение.');
    const reason = this.requireReason(dto.reason);
    const editable = ['title', 'subjectType', 'recurrenceRule', 'dayOfWeek', 'startTime', 'endTime', 'pairNumber', 'weekType', 'room', 'building', 'validFrom', 'validTo', 'groupId', 'teacherId'] as const;
    if (!editable.some(field => dto[field] !== undefined)) throw new BadRequestException('Укажите хотя бы одно поле серии для изменения.');

    const saved = await this.db.transaction(async manager => {
      const seriesRepo = manager.getRepository(LessonSeries);
      const series = await seriesRepo.createQueryBuilder('s').setLock('pessimistic_write').where('s.id = :id', { id }).getOne();
      if (!series) throw new NotFoundException('Серия занятий не найдена.');
      this.platform.assertUniversityScope(access, series.universityId);
      if (series.source !== 'manual') throw new ConflictException('Серия получена из внешнего источника и доступна только для просмотра. Исправьте её в источнике синхронизации.');
      const context = await this.seriesContext(manager, id, {
        allowGroupMismatch: dto.groupId !== undefined,
        allowTeacherMismatch: dto.teacherId !== undefined,
      });
      const oldValues = this.seriesSnapshot(series);

      if (dto.groupId !== undefined) {
        const group = await manager.getRepository(Group).findOne({ where: { id: dto.groupId, universityId: series.universityId } });
        if (!group) throw new BadRequestException('Группа должна принадлежать тому же вузу, что и серия.');
        series.groupId = group.id;
      }
      if (dto.teacherId !== undefined) {
        if (dto.teacherId === null) series.teacherId = null;
        else {
          const teacher = await manager.getRepository(User).findOne({ where: { id: dto.teacherId, universityId: series.universityId, role: UserRole.TEACHER } });
          if (!teacher) throw new BadRequestException('Преподаватель должен иметь роль преподавателя и принадлежать тому же вузу, что и серия.');
          series.teacherId = teacher.id;
        }
      }
      if (dto.title !== undefined) series.title = this.cleanNullable(dto.title);
      if (dto.subjectType !== undefined) series.subjectType = this.cleanNullable(dto.subjectType);
      if (dto.recurrenceRule !== undefined) series.recurrenceRule = this.requireNonBlank(dto.recurrenceRule, 'Правило повторения');
      if (dto.dayOfWeek !== undefined) series.dayOfWeek = dto.dayOfWeek;
      if (dto.startTime !== undefined) series.startTime = dto.startTime;
      if (dto.endTime !== undefined) series.endTime = dto.endTime;
      if (dto.pairNumber !== undefined) series.pairNumber = dto.pairNumber;
      if (dto.weekType !== undefined) series.weekType = dto.weekType;
      if (dto.room !== undefined) series.room = this.cleanNullable(dto.room);
      if (dto.building !== undefined) series.building = this.cleanNullable(dto.building);
      if (dto.validFrom !== undefined) series.validFrom = new Date(dto.validFrom);
      if (dto.validTo !== undefined) series.validTo = dto.validTo === null ? null : new Date(dto.validTo);

      if (series.startTime >= series.endTime) throw new BadRequestException('Время начала серии должно предшествовать времени окончания.');
      if (!Number.isFinite(series.validFrom.getTime()) || (series.validTo && !Number.isFinite(series.validTo.getTime())) || (series.validTo && series.validFrom >= series.validTo)) {
        throw new BadRequestException('Дата начала серии должна предшествовать дате окончания.');
      }
      const updated = await seriesRepo.save(series);
      const newValues = this.seriesSnapshot(updated);
      await manager.getRepository(AuditLog).save({
        userId: access.actorId, action: 'platform.academic_series.updated', entity: 'academic_series', entityId: updated.id,
        oldValues: { ...oldValues, universityId: context.series.universityId, courseId: context.series.courseId },
        newValues: { ...newValues, universityId: context.series.universityId, courseId: context.series.courseId, reason, existingOccurrencesUpdated: false },
        ...this.auditContext(auditContext),
      });
      return updated;
    });
    const [result, existingOccurrencesCount] = await Promise.all([
      this.getSeriesAfterWrite(saved.id),
      this.db.getRepository(LessonOccurrence).count({ where: { seriesId: saved.id } }),
    ]);
    return { ...result, existingOccurrencesCount, occurrenceUpdateNotice: SERIES_SNAPSHOT_NOTICE };
  }

  private async getCourseAfterWrite(id: string) {
    const context = await this.courseContext(this.db.manager, id);
    return this.courseListItem(context.course, { university_name: context.university.name, faculty_name: context.faculty?.name ?? null });
  }

  private async getSeriesAfterWrite(id: string) {
    const context = await this.seriesContext(this.db.manager, id);
    return this.seriesListItem(context.series, {
      university_name: context.university.name,
      course_name: context.course.name,
      course_code: context.course.code,
      group_name: context.group?.name ?? null,
      teacher_name: context.teacher ? `${context.teacher.firstName} ${context.teacher.lastName}`.trim() : null,
    });
  }

  private async courseContext(manager: EntityManager, id: string, allowFacultyRepair = false): Promise<CourseContext> {
    const course = await manager.getRepository(Course).findOne({ where: { id } });
    if (!course) throw new NotFoundException('Курс каталога не найден.');
    const [university, faculty] = await Promise.all([
      manager.getRepository(University).findOne({ where: { id: course.universityId } }),
      course.facultyId ? manager.getRepository(Faculty).findOne({ where: { id: course.facultyId } }) : null,
    ]);
    if (!university) throw new ConflictException('У курса отсутствует связанный вуз. Операция отменена до восстановления связи.');
    if (course.facultyId && (!faculty || faculty.universityId !== course.universityId) && !allowFacultyRepair) {
      throw new ConflictException('Факультет курса не принадлежит его вузу. Сначала восстановите связь в исходных данных.');
    }
    return { course, university, faculty: faculty?.universityId === course.universityId ? faculty : null };
  }

  private async seriesContext(
    manager: EntityManager,
    id: string,
    options: { allowGroupMismatch?: boolean; allowTeacherMismatch?: boolean } = {},
  ): Promise<SeriesContext> {
    const series = await manager.getRepository(LessonSeries).findOne({ where: { id } });
    if (!series) throw new NotFoundException('Серия занятий не найдена.');
    const [university, course, group, teacher] = await Promise.all([
      manager.getRepository(University).findOne({ where: { id: series.universityId } }),
      manager.getRepository(Course).findOne({ where: { id: series.courseId } }),
      manager.getRepository(Group).findOne({ where: { id: series.groupId } }),
      series.teacherId ? manager.getRepository(User).findOne({ where: { id: series.teacherId }, select: ['id', 'firstName', 'lastName', 'universityId', 'role'] }) : null,
    ]);
    if (!university) throw new ConflictException('У серии отсутствует связанный вуз. Операция отменена до восстановления связи.');
    if (!course || course.universityId !== series.universityId) throw new ConflictException('Курс серии не принадлежит её вузу. Сначала восстановите связь в исходных данных.');
    if ((!group || group.universityId !== series.universityId) && !options.allowGroupMismatch) throw new ConflictException('Группа серии не принадлежит её вузу. Сначала восстановите связь в исходных данных.');
    const invalidTeacher = series.teacherId && (!teacher || teacher.universityId !== series.universityId || teacher.role !== UserRole.TEACHER);
    if (invalidTeacher && !options.allowTeacherMismatch) {
      throw new ConflictException('Преподаватель серии не принадлежит её вузу или имеет другую роль. Сначала восстановите связь в исходных данных.');
    }
    return {
      series, university, course,
      group: group?.universityId === series.universityId ? group : null,
      teacher: teacher?.universityId === series.universityId && teacher.role === UserRole.TEACHER ? teacher : null,
    };
  }

  private applySearch(qb: any, value: string | undefined, expression: string): void {
    const trimmed = value?.trim();
    if (!trimmed) return;
    const escaped = `%${trimmed.replace(/[\\%_]/g, '\\$&')}%`;
    qb.andWhere(`(${expression})`, { q: escaped });
  }

  private courseListItem(course: Course, raw: Record<string, unknown>) {
    return {
      id: course.id, universityId: course.universityId, universityName: raw.catalog_university_name as string | null ?? raw.university_name as string | null ?? null,
      facultyId: course.facultyId, facultyName: raw.catalog_faculty_name as string | null ?? raw.faculty_name as string | null ?? null,
      code: course.code, name: course.name, description: course.description, credits: course.credits,
      isActive: course.isActive, source: course.source, syncStatus: course.syncStatus,
      lastSyncedAt: course.lastSyncedAt?.toISOString() ?? null, sourceVersion: course.sourceVersion,
      createdAt: course.createdAt?.toISOString() ?? null, updatedAt: course.updatedAt?.toISOString() ?? null,
    };
  }

  private seriesListItem(series: LessonSeries, raw: Record<string, unknown>) {
    return {
      id: series.id, universityId: series.universityId, universityName: raw.catalog_university_name as string | null ?? raw.university_name as string | null ?? null,
      courseId: series.courseId, courseCode: raw.catalog_course_code as string | null ?? raw.course_code as string | null ?? null,
      courseName: raw.catalog_course_name as string | null ?? raw.course_name as string | null ?? null,
      groupId: series.groupId, groupName: raw.catalog_group_name as string | null ?? raw.group_name as string | null ?? null,
      teacherId: series.teacherId, teacherName: raw.catalog_teacher_name as string | null ?? raw.teacher_name as string | null ?? null,
      title: series.title, subjectType: series.subjectType, recurrenceRule: series.recurrenceRule,
      dayOfWeek: series.dayOfWeek, startTime: series.startTime, endTime: series.endTime, pairNumber: series.pairNumber,
      weekType: series.weekType, room: series.room, building: series.building,
      validFrom: series.validFrom.toISOString(), validTo: series.validTo?.toISOString() ?? null,
      source: series.source, syncStatus: series.syncStatus, lastSyncedAt: series.lastSyncedAt?.toISOString() ?? null,
      sourceVersion: series.sourceVersion, createdAt: series.createdAt?.toISOString() ?? null, updatedAt: series.updatedAt?.toISOString() ?? null,
    };
  }

  private courseSnapshot(course: Course): JsonObject {
    return {
      code: course.code, name: course.name, facultyId: course.facultyId ?? null, description: course.description ?? null,
      credits: course.credits ?? null, isActive: course.isActive,
    };
  }

  private seriesSnapshot(series: LessonSeries): JsonObject {
    return {
      title: series.title ?? null, subjectType: series.subjectType ?? null, recurrenceRule: series.recurrenceRule,
      dayOfWeek: series.dayOfWeek, startTime: series.startTime, endTime: series.endTime, pairNumber: series.pairNumber,
      weekType: series.weekType, room: series.room ?? null, building: series.building ?? null,
      validFrom: series.validFrom.toISOString(), validTo: series.validTo?.toISOString() ?? null,
      groupId: series.groupId, teacherId: series.teacherId ?? null,
    };
  }

  private historyItem(entry: AuditLog) {
    return {
      id: entry.id, action: entry.action, actorId: entry.userId, timestamp: entry.createdAt.toISOString(),
      oldValues: entry.oldValues ?? null, newValues: entry.newValues ?? null,
    };
  }

  private requireReason(value: string): string {
    const reason = value?.trim();
    if (!reason || reason.length < 3 || reason.length > 500) throw new BadRequestException('Причина должна содержать от 3 до 500 символов.');
    return reason;
  }

  private requireNonBlank(value: string, label: string): string {
    const normalized = value.trim();
    if (!normalized) throw new BadRequestException(`${label}: значение не может быть пустым.`);
    return normalized;
  }

  private cleanNullable(value: string | null): string | null {
    const normalized = value?.trim();
    return normalized || null;
  }

  private auditContext(context: AuditContext) {
    return {
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    };
  }
}

function isUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; driverError?: { code?: string } };
  return candidate.code === '23505' || candidate.driverError?.code === '23505';
}
