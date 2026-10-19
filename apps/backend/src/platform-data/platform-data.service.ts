import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { JsonObject, JsonValue } from '../common/types/json-value.type';
import { Absence } from '../absences/entities/absence.entity';
import { AttendanceRecord } from '../absences/entities/attendance-record.entity';
import { AbsenceConfirmation } from '../absences/entities/absence-confirmation.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { PlatformService } from '../platform/platform.service';
import { PlatformAbsenceConfirmationCorrectionDto, PlatformAbsenceConfirmationQueryDto, PlatformAbsenceCorrectionDto, PlatformAbsenceQueryDto, PlatformAttendanceCorrectionDto, PlatformAttendanceQueryDto } from './platform-data.dto';

type AbsenceSearchRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityId: string;
  universityName: string;
  type: string;
  startDate: Date;
  endDate: Date;
  comment: string | null;
  isSensitive: boolean;
  confirmationRequired: boolean;
  affectedLessonsCount: number;
  source: string | null;
  syncStatus: string;
  createdAt: Date;
};

type AttendanceSearchRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityId: string;
  universityName: string;
  lessonId: string;
  lessonSubject: string;
  lessonStartDate: Date;
  status: string;
  comment: string | null;
  markedById: string | null;
  updatedAt: Date;
};
type AbsenceConfirmationSearchRow = {
  id: string;
  absenceId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityId: string;
  universityName: string;
  curatorId: string;
  curatorName: string | null;
  curatorEmail: string | null;
  status: string;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type RequestAuditContext = { ip?: string; userAgent?: string };

type MutableAbsenceField = 'type' | 'startDate' | 'endDate' | 'comment' | 'isSensitive' | 'confirmationRequired';
type MutableAttendanceField = 'status' | 'comment';
type AbsenceCorrectionPatch = Partial<Omit<Absence, 'comment'>> & { comment?: string | null };

@Injectable()
export class PlatformDataService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async absences(query: PlatformAbsenceQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('student-data.read');
    if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
    this.assertQueryDateRange(query.startDate, query.endDate);
    const qb = this.db.getRepository(Absence).createQueryBuilder('a')
      .innerJoin(User, 'student', 'student.id = a.studentId AND student.universityId = a.universityId AND student.role = :studentRole', { studentRole: UserRole.STUDENT })
      .innerJoin(University, 'university', 'university.id = a.universityId')
      .select('a.id', 'id')
      .addSelect('a.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail')
      .addSelect('a.universityId', 'universityId')
      .addSelect('university.name', 'universityName')
      .addSelect('a.type', 'type')
      .addSelect('a.startDate', 'startDate')
      .addSelect('a.endDate', 'endDate')
      .addSelect('a.comment', 'comment')
      .addSelect('a.isSensitive', 'isSensitive')
      .addSelect('a.confirmationRequired', 'confirmationRequired')
      .addSelect('a.affectedLessonsCount', 'affectedLessonsCount')
      .addSelect('a.source', 'source')
      .addSelect('a.syncStatus', 'syncStatus')
      .addSelect('a.createdAt', 'createdAt');

    if (query.universityId) qb.andWhere('a.universityId = :universityId', { universityId: query.universityId });
    this.applyUniversityScope(qb, access, 'a.universityId');
    if (query.type) qb.andWhere('a.type = :type', { type: query.type });
    if (query.confirmationRequired !== undefined) qb.andWhere('a.confirmationRequired = :confirmationRequired', { confirmationRequired: query.confirmationRequired });
    if (query.startDate) qb.andWhere('a.startDate >= :startDate', { startDate: new Date(query.startDate) });
    if (query.endDate) qb.andWhere('a.startDate <= :endDate', { endDate: new Date(query.endDate) });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['a.id::text', 'student.id::text', 'student.email', "concat_ws(' ', student.firstName, student.lastName)", 'COALESCE(a.comment, \'\')']);

    const [data, total] = await this.paginateRaw<AbsenceSearchRow>(qb, query.page, query.limit, 'a.createdAt', 'a.id');
    await this.auditSearch(access.actorId, 'absence_search', query, total, data, context);
    return toPaginatedResponse(data, total, query);
  }

  async attendance(query: PlatformAttendanceQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('student-data.read');
    if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
    this.assertQueryDateRange(query.startDate, query.endDate);
    const qb = this.db.getRepository(AttendanceRecord).createQueryBuilder('record')
      .innerJoin(User, 'student', 'student.id = record.studentId AND student.universityId = record.universityId AND student.role = :studentRole', { studentRole: UserRole.STUDENT })
      .innerJoin(Lesson, 'lesson', 'lesson.id = record.lessonId AND lesson.universityId = record.universityId')
      .innerJoin(University, 'university', 'university.id = record.universityId')
      .select('record.id', 'id')
      .addSelect('record.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail')
      .addSelect('record.universityId', 'universityId')
      .addSelect('university.name', 'universityName')
      .addSelect('record.lessonId', 'lessonId')
      .addSelect('lesson.subject', 'lessonSubject')
      .addSelect('lesson.startDate', 'lessonStartDate')
      .addSelect('record.status', 'status')
      .addSelect('record.comment', 'comment')
      .addSelect('record.markedById', 'markedById')
      .addSelect('record.updatedAt', 'updatedAt');

    if (query.universityId) qb.andWhere('record.universityId = :universityId', { universityId: query.universityId });
    this.applyUniversityScope(qb, access, 'record.universityId');
    if (query.status) qb.andWhere('record.status = :status', { status: query.status });
    if (query.startDate) qb.andWhere('lesson.startDate >= :startDate', { startDate: new Date(query.startDate) });
    if (query.endDate) qb.andWhere('lesson.startDate <= :endDate', { endDate: new Date(query.endDate) });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['record.id::text', 'student.id::text', 'student.email', "concat_ws(' ', student.firstName, student.lastName)", 'lesson.subject', 'COALESCE(record.comment, \'\')']);

    const [data, total] = await this.paginateRaw<AttendanceSearchRow>(qb, query.page, query.limit, 'record.updatedAt', 'record.id');
    await this.auditSearch(access.actorId, 'attendance_search', query, total, data, context);
    return toPaginatedResponse(data, total, query);
  }

  async absenceConfirmations(query: PlatformAbsenceConfirmationQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('student-data.read');
    if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
    const qb = this.absenceConfirmationQuery();
    if (query.universityId) qb.andWhere('absence.universityId = :universityId', { universityId: query.universityId });
    this.applyUniversityScope(qb, access, 'absence.universityId');
    if (query.status) qb.andWhere('confirmation.status = :status', { status: query.status });
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(confirmation.id::text ILIKE :q ESCAPE E'\\\\' OR confirmation.absenceId::text ILIKE :q ESCAPE E'\\\\' OR confirmation.curatorId::text ILIKE :q ESCAPE E'\\\\' OR absence.studentId::text ILIKE :q ESCAPE E'\\\\' OR student.email ILIKE :q ESCAPE E'\\\\' OR curator.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', student.firstName, student.lastName) ILIKE :q ESCAPE E'\\\\' OR COALESCE(confirmation.comment, '') ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
    const total = await qb.clone().getCount();
    const data = await qb.orderBy('confirmation.createdAt', 'DESC').addOrderBy('confirmation.id', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawMany<AbsenceConfirmationSearchRow>();
    await this.auditSearch(access.actorId, 'absence_confirmation_search', query, total, data, context);
    return toPaginatedResponse(data, total, query);
  }

  async absenceConfirmation(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('student-data.read');
    return this.db.transaction(async manager => {
      const confirmation = await manager.findOne(AbsenceConfirmation, { where: { id } });
      if (!confirmation) throw new NotFoundException('Решение по отсутствию не найдено.');
      const related = await this.assertAbsenceConfirmationContext(manager, confirmation);
      this.platform.assertUniversityScope(access, related.absence.universityId);
      await manager.save(AuditLog, manager.create(AuditLog, {
        userId: access.actorId,
        action: 'platform.absence_confirmation.viewed',
        entity: 'absence_confirmation',
        entityId: id,
        newValues: { targetUserId: related.absence.studentId, universityId: related.absence.universityId, absenceId: confirmation.absenceId, curatorId: confirmation.curatorId, result: 'viewed' },
        ip: context.ip,
        userAgent: context.userAgent?.slice(0, 512),
      }));
      return {
        ...confirmation,
        studentId: related.absence.studentId,
        studentName: `${related.student.firstName} ${related.student.lastName}`.trim(),
        studentEmail: related.student.email,
        universityId: related.absence.universityId,
        universityName: related.university.name,
        curatorName: related.curator ? `${related.curator.firstName} ${related.curator.lastName}`.trim() : null,
        curatorEmail: related.curator?.email ?? null,
      };
    });
  }

  async correctAbsenceConfirmation(id: string, dto: PlatformAbsenceConfirmationCorrectionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('student-data.write');
    this.assertReason(dto.reason);
    if (dto.status === undefined && dto.comment === undefined && dto.confirmedAt === undefined) throw new BadRequestException('Укажите хотя бы одно поле для исправления.');
    return this.db.transaction(async manager => {
      const confirmation = await manager.findOne(AbsenceConfirmation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!confirmation) throw new NotFoundException('Решение по отсутствию не найдено.');
      const related = await this.assertAbsenceConfirmationContext(manager, confirmation);
      this.platform.assertUniversityScope(access, related.absence.universityId);
      const oldValues: JsonObject = { status: confirmation.status, comment: confirmation.comment ?? null, confirmedAt: confirmation.confirmedAt?.toISOString() ?? null };
      const previousStatus = confirmation.status;
      if (dto.status !== undefined) confirmation.status = dto.status;
      if (dto.comment !== undefined) confirmation.comment = dto.comment?.trim() || null;
      if (dto.confirmedAt !== undefined) confirmation.confirmedAt = dto.confirmedAt === null ? null : new Date(dto.confirmedAt);
      if (dto.status === 'pending' && dto.confirmedAt !== undefined && dto.confirmedAt !== null) throw new BadRequestException('Для решения pending дата подтверждения должна быть пустой.');
      if (dto.status === 'pending') confirmation.confirmedAt = null;
      else if ((confirmation.status === 'confirmed' || confirmation.status === 'rejected') && dto.confirmedAt === null) throw new BadRequestException('Для решения confirmed или rejected дата подтверждения не может быть пустой.');
      else if ((confirmation.status === 'confirmed' || confirmation.status === 'rejected') && (confirmation.confirmedAt === null || (dto.status !== undefined && dto.status !== previousStatus && dto.confirmedAt === undefined))) confirmation.confirmedAt = new Date();
      if (confirmation.status === 'pending' && confirmation.confirmedAt !== null) throw new BadRequestException('У решения со статусом pending дата подтверждения должна быть пустой.');
      if (confirmation.status !== 'pending' && confirmation.confirmedAt === null) throw new BadRequestException('Для решения confirmed или rejected нужна дата подтверждения.');
      const newValues: JsonObject = { status: confirmation.status, comment: confirmation.comment ?? null, confirmedAt: confirmation.confirmedAt?.toISOString() ?? null };
      if (JSON.stringify(oldValues) === JSON.stringify(newValues)) throw new BadRequestException('Исправленные значения совпадают с текущими.');
      const updated = await manager.save(AbsenceConfirmation, confirmation);
      await manager.save(AuditLog, manager.create(AuditLog, {
        userId: access.actorId,
        action: 'platform.absence_confirmation.corrected',
        entity: 'absence_confirmation',
        entityId: id,
        oldValues,
        newValues: { ...newValues, targetUserId: related.absence.studentId, universityId: related.absence.universityId, absenceId: confirmation.absenceId, curatorId: confirmation.curatorId, reason: dto.reason.trim(), result: 'corrected' },
        ip: context.ip,
        userAgent: context.userAgent?.slice(0, 512),
      }));
      return { ...updated, studentId: related.absence.studentId, universityId: related.absence.universityId };
    });
  }

  async correctAbsence(id: string, dto: PlatformAbsenceCorrectionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('student-data.write');
    this.assertReason(dto.reason);
    const changes = this.pickChanges<MutableAbsenceField>(dto, ['type', 'startDate', 'endDate', 'comment', 'isSensitive', 'confirmationRequired']);
    if (!Object.keys(changes).length) throw new BadRequestException('Укажите хотя бы одно поле для исправления.');

    return this.db.transaction(async manager => {
      const absence = await manager.findOne(Absence, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!absence) throw new NotFoundException('Запись отсутствия не найдена.');
      this.platform.assertUniversityScope(access, absence.universityId);
      const student = await this.assertStudentReference(manager, absence.studentId, absence.universityId);
      await this.assertAbsenceLessonReferences(manager, absence);

      const previous = this.snapshot(absence, changes);
      const patch = this.normalizeAbsenceChanges(changes, absence);
      Object.assign(absence, patch);
      this.assertDateRange(absence.startDate, absence.endDate);

      const updated = await manager.save(Absence, absence);
      await manager.save(AuditLog, manager.create(AuditLog, {
        userId: access.actorId,
        action: 'platform.absence.corrected',
        entity: 'absence',
        entityId: id,
        oldValues: previous,
        newValues: { ...this.snapshot(updated, patch), targetUserId: updated.studentId, universityId: updated.universityId, reason: dto.reason.trim() },
        ip: context.ip,
        userAgent: context.userAgent?.slice(0, 512),
      }));
      return {
        ...this.absenceSnapshot(updated),
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        studentEmail: student.email,
      };
    });
  }

  async correctAttendance(id: string, dto: PlatformAttendanceCorrectionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('student-data.write');
    this.assertReason(dto.reason);
    const changes = this.pickChanges<MutableAttendanceField>(dto, ['status', 'comment']);
    if (!Object.keys(changes).length) throw new BadRequestException('Укажите хотя бы одно поле для исправления.');

    return this.db.transaction(async manager => {
      const record = await manager.findOne(AttendanceRecord, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Запись посещаемости не найдена.');
      this.platform.assertUniversityScope(access, record.universityId);
      const student = await this.assertStudentReference(manager, record.studentId, record.universityId);
      const lesson = await manager.findOne(Lesson, { where: { id: record.lessonId, universityId: record.universityId } });
      if (!lesson) throw new BadRequestException('Занятие не принадлежит вузу записи посещаемости.');
      await manager.findOneOrFail(University, { where: { id: record.universityId } }).catch(() => {
        throw new BadRequestException('Университет записи посещаемости не найден.');
      });
      const previous = this.snapshot(record, changes);
      const patch = this.normalizeAttendanceChanges(changes);
      Object.assign(record, patch);
      const updated = await manager.save(AttendanceRecord, record);
      await manager.save(AuditLog, manager.create(AuditLog, {
        userId: access.actorId,
        action: 'platform.attendance.corrected',
        entity: 'attendance_record',
        entityId: id,
        oldValues: previous,
        newValues: { ...this.snapshot(updated, patch), targetUserId: updated.studentId, universityId: updated.universityId, reason: dto.reason.trim() },
        ip: context.ip,
        userAgent: context.userAgent?.slice(0, 512),
      }));
      return this.attendanceSnapshot(updated, lesson, student);
    });
  }

  private async assertStudentReference(manager: EntityManager, studentId: string, universityId: string): Promise<User> {
    const university = await manager.findOne(University, { where: { id: universityId } });
    if (!university) throw new BadRequestException('Университет записи не найден.');
    const student = await manager.findOne(User, { where: { id: studentId, universityId, role: UserRole.STUDENT } });
    if (!student) throw new BadRequestException('Студент записи не принадлежит указанному вузу.');
    return student;
  }

  private applyUniversityScope<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, access: Awaited<ReturnType<PlatformService['access']>>, column: string) {
    if (access.owner || access.universityIds === null) return;
    if (!access.universityIds.length) qb.andWhere('1 = 0');
    else qb.andWhere(`${column} IN (:...allowedUniversityIds)`, { allowedUniversityIds: access.universityIds });
  }

  private absenceConfirmationQuery(): SelectQueryBuilder<AbsenceConfirmation> {
    return this.db.getRepository(AbsenceConfirmation).createQueryBuilder('confirmation')
      .innerJoin(Absence, 'absence', 'absence.id = confirmation.absenceId')
      .innerJoin(User, 'student', 'student.id = absence.studentId')
      .innerJoin(University, 'university', 'university.id = absence.universityId')
      .leftJoin(User, 'curator', 'curator.id = confirmation.curatorId')
      .select('confirmation.id', 'id').addSelect('confirmation.absenceId', 'absenceId')
      .addSelect('absence.studentId', 'studentId').addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('absence.universityId', 'universityId')
      .addSelect('university.name', 'universityName')
      .addSelect('confirmation.curatorId', 'curatorId').addSelect("concat_ws(' ', curator.firstName, curator.lastName)", 'curatorName')
      .addSelect('curator.email', 'curatorEmail').addSelect('confirmation.status', 'status')
      .addSelect('confirmation.confirmedAt', 'confirmedAt').addSelect('confirmation.createdAt', 'createdAt')
      .addSelect('confirmation.updatedAt', 'updatedAt');
  }

  private async assertAbsenceConfirmationContext(manager: EntityManager, confirmation: AbsenceConfirmation) {
    const absence = await manager.findOne(Absence, { where: { id: confirmation.absenceId }, lock: { mode: 'pessimistic_read' } });
    if (!absence) throw new BadRequestException('Решение не связано с существующим отсутствием.');
    const [student, university, curator] = await Promise.all([
      manager.findOne(User, { where: { id: absence.studentId }, select: ['id', 'firstName', 'lastName', 'email'] }),
      manager.findOne(University, { where: { id: absence.universityId }, select: ['id', 'name'] }),
      manager.findOne(User, { where: { id: confirmation.curatorId }, select: ['id', 'firstName', 'lastName', 'email'] }),
    ]);
    if (!student || !university) throw new BadRequestException('Решение связано с отсутствующим студентом или университетом.');
    return { absence, student, university, curator };
  }

  private async auditSearch(actorId: string, entity: string, query: PlatformAbsenceQueryDto | PlatformAttendanceQueryDto | PlatformAbsenceConfirmationQueryDto, total: number, records: Array<{ id: string; studentId: string; universityId: string }>, context: RequestAuditContext): Promise<void> {
    await this.db.getRepository(AuditLog).save({
      userId: actorId,
      action: `platform.student_data.${entity}`,
      entity,
      entityId: 'search',
      newValues: {
        universityId: query.universityId ?? null,
        filters: {
          queryPresent: Boolean(query.q?.trim()),
          status: 'status' in query ? query.status ?? null : null,
          type: 'type' in query ? query.type ?? null : null,
          confirmationRequired: 'confirmationRequired' in query ? query.confirmationRequired ?? null : null,
          startDate: 'startDate' in query ? query.startDate ?? null : null,
          endDate: 'endDate' in query ? query.endDate ?? null : null,
          page: query.page,
          limit: query.limit,
        },
        total,
        resultCount: records.length,
        recordIds: records.map(record => record.id),
        targetUserIds: [...new Set(records.map(record => record.studentId))],
        universityIds: [...new Set(records.map(record => record.universityId))],
      },
      ip: context.ip,
      userAgent: context.userAgent?.slice(0, 512),
    });
  }

  private async assertAbsenceLessonReferences(manager: EntityManager, absence: Absence): Promise<void> {
    const ids = absence.affectedLessonIds ?? [];
    if (!ids.length) return;
    const lessons = await manager.getRepository(Lesson).createQueryBuilder('lesson')
      .select('lesson.id', 'id')
      .where('lesson.id IN (:...ids) AND lesson.universityId = :universityId', { ids, universityId: absence.universityId })
      .getRawMany<{ id: string }>();
    if (lessons.length !== new Set(ids).size) throw new BadRequestException('Связанные занятия отсутствия не принадлежат указанному вузу или недоступны.');
  }

  private async paginateRaw<T>(qb: SelectQueryBuilder<Absence> | SelectQueryBuilder<AttendanceRecord>, page: number, limit: number, dateField: string, idField: string): Promise<[T[], number]> {
    const total = await qb.clone().getCount();
    const data = await qb.orderBy(dateField, 'DESC').addOrderBy(idField, 'DESC')
      .skip((page - 1) * limit).take(limit).getRawMany<T>();
    return [data, total];
  }

  private applySearch(qb: SelectQueryBuilder<Absence> | SelectQueryBuilder<AttendanceRecord>, query: string, expressions: string[]): void {
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    qb.andWhere(`(${expressions.map(expression => `${expression} ILIKE :q ESCAPE E'\\\\'`).join(' OR ')})`, { q: pattern });
  }

  private assertReason(reason: string): void {
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину исправления (не менее 3 символов).');
  }

  private pickChanges<T extends string>(dto: object, fields: readonly T[]): Partial<Record<T, unknown>> {
    const source = dto as Record<string, unknown>;
    return Object.fromEntries(fields.filter(field => source[field] !== undefined).map(field => [field, source[field]])) as Partial<Record<T, unknown>>;
  }

  private normalizeAbsenceChanges(changes: Partial<Record<MutableAbsenceField, unknown>>, current: Absence): AbsenceCorrectionPatch {
    const patch: AbsenceCorrectionPatch = {};
    for (const field of ['startDate', 'endDate'] as const) {
      const value = changes[field];
      if (value === null) throw new BadRequestException(`Поле ${field} не может быть пустым.`);
      if (typeof value === 'string') patch[field] = new Date(value);
    }
    for (const field of ['type', 'isSensitive', 'confirmationRequired'] as const) {
      if (changes[field] !== undefined) {
        if (changes[field] === null) throw new BadRequestException(`Поле ${field} не может быть пустым.`);
        Object.assign(patch, { [field]: changes[field] });
      }
    }
    if (changes.comment !== undefined) patch.comment = typeof changes.comment === 'string' ? changes.comment.trim() || null : null;
    if (patch.startDate && Number.isNaN(patch.startDate.getTime())) throw new BadRequestException('Некорректная дата начала отсутствия.');
    if (patch.endDate && Number.isNaN(patch.endDate.getTime())) throw new BadRequestException('Некорректная дата окончания отсутствия.');
    this.assertDateRange(patch.startDate ?? current.startDate, patch.endDate ?? current.endDate);
    return patch;
  }

  private normalizeAttendanceChanges(changes: Partial<Record<MutableAttendanceField, unknown>>): Partial<AttendanceRecord> {
    const patch: Partial<AttendanceRecord> = {};
    if (changes.status !== undefined) {
      if (changes.status === null) throw new BadRequestException('Статус посещаемости не может быть пустым.');
      patch.status = changes.status as AttendanceRecord['status'];
    }
    if (changes.comment !== undefined) patch.comment = typeof changes.comment === 'string' ? changes.comment.trim() || null : null;
    return patch;
  }

  private assertDateRange(startDate: Date, endDate: Date): void {
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate < startDate) {
      throw new BadRequestException('Период отсутствия указан некорректно.');
    }
  }

  private snapshot<T extends object>(entity: T, changes: Partial<Record<string, unknown>>): JsonObject {
    return Object.fromEntries(Object.keys(changes).map(field => {
      const value = (entity as Record<string, unknown>)[field];
      return [field, value instanceof Date ? value.toISOString() : value as JsonValue];
    })) as JsonObject;
  }

  private assertQueryDateRange(startDate?: string, endDate?: string): void {
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException('Конец периода не может быть раньше его начала.');
    }
  }

  private absenceSnapshot(absence: Absence) {
    return {
      id: absence.id,
      universityId: absence.universityId,
      studentId: absence.studentId,
      type: absence.type,
      startDate: absence.startDate,
      endDate: absence.endDate,
      comment: absence.comment,
      isSensitive: absence.isSensitive,
      confirmationRequired: absence.confirmationRequired,
      affectedLessonsCount: absence.affectedLessonsCount,
      source: absence.source,
      syncStatus: absence.syncStatus,
      createdAt: absence.createdAt,
    };
  }

  private attendanceSnapshot(record: AttendanceRecord, lesson: Lesson, student: User) {
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      studentEmail: student.email,
      universityId: record.universityId,
      lessonId: record.lessonId,
      lessonSubject: lesson.subject,
      lessonStartDate: lesson.startDate,
      status: record.status,
      comment: record.comment,
      markedById: record.markedById,
      updatedAt: record.updatedAt,
    };
  }
}
