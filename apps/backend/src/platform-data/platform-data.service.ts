import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { JsonObject, JsonValue } from '../common/types/json-value.type';
import { Absence } from '../absences/entities/absence.entity';
import { AttendanceRecord } from '../absences/entities/attendance-record.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { UserRole } from '../auth/interfaces/user-role';
import { PlatformService } from '../platform/platform.service';
import { PlatformAbsenceCorrectionDto, PlatformAbsenceQueryDto, PlatformAttendanceCorrectionDto, PlatformAttendanceQueryDto } from './platform-data.dto';

type AbsenceSearchRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityId: string;
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
  lessonId: string;
  lessonSubject: string;
  lessonStartDate: Date;
  status: string;
  comment: string | null;
  markedById: string | null;
  updatedAt: Date;
};

type MutableAbsenceField = 'type' | 'startDate' | 'endDate' | 'comment' | 'isSensitive' | 'confirmationRequired';
type MutableAttendanceField = 'status' | 'comment';
type AbsenceCorrectionPatch = Partial<Omit<Absence, 'comment'>> & { comment?: string | null };

@Injectable()
export class PlatformDataService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async absences(query: PlatformAbsenceQueryDto) {
    await this.platform.require('student-data.read');
    this.assertQueryDateRange(query.startDate, query.endDate);
    const qb = this.db.getRepository(Absence).createQueryBuilder('a')
      .innerJoin(User, 'student', 'student.id = a.studentId AND student.universityId = a.universityId AND student.role = :studentRole', { studentRole: UserRole.STUDENT })
      .innerJoin(University, 'university', 'university.id = a.universityId')
      .select('a.id', 'id')
      .addSelect('a.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail')
      .addSelect('a.universityId', 'universityId')
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
    if (query.type) qb.andWhere('a.type = :type', { type: query.type });
    if (query.confirmationRequired !== undefined) qb.andWhere('a.confirmationRequired = :confirmationRequired', { confirmationRequired: query.confirmationRequired });
    if (query.startDate) qb.andWhere('a.startDate >= :startDate', { startDate: new Date(query.startDate) });
    if (query.endDate) qb.andWhere('a.startDate <= :endDate', { endDate: new Date(query.endDate) });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['a.id::text', 'student.email', "concat_ws(' ', student.firstName, student.lastName)", 'COALESCE(a.comment, \'\')']);

    const [data, total] = await this.paginateRaw<AbsenceSearchRow>(qb, query.page, query.limit, 'a.createdAt', 'a.id');
    return toPaginatedResponse(data, total, query);
  }

  async attendance(query: PlatformAttendanceQueryDto) {
    await this.platform.require('student-data.read');
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
      .addSelect('record.lessonId', 'lessonId')
      .addSelect('lesson.subject', 'lessonSubject')
      .addSelect('lesson.startDate', 'lessonStartDate')
      .addSelect('record.status', 'status')
      .addSelect('record.comment', 'comment')
      .addSelect('record.markedById', 'markedById')
      .addSelect('record.updatedAt', 'updatedAt');

    if (query.universityId) qb.andWhere('record.universityId = :universityId', { universityId: query.universityId });
    if (query.status) qb.andWhere('record.status = :status', { status: query.status });
    if (query.startDate) qb.andWhere('lesson.startDate >= :startDate', { startDate: new Date(query.startDate) });
    if (query.endDate) qb.andWhere('lesson.startDate <= :endDate', { endDate: new Date(query.endDate) });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['record.id::text', 'student.email', "concat_ws(' ', student.firstName, student.lastName)", 'lesson.subject', 'COALESCE(record.comment, \'\')']);

    const [data, total] = await this.paginateRaw<AttendanceSearchRow>(qb, query.page, query.limit, 'record.updatedAt', 'record.id');
    return toPaginatedResponse(data, total, query);
  }

  async correctAbsence(id: string, dto: PlatformAbsenceCorrectionDto) {
    const access = await this.platform.require('student-data.write');
    this.assertReason(dto.reason);
    const changes = this.pickChanges<MutableAbsenceField>(dto, ['type', 'startDate', 'endDate', 'comment', 'isSensitive', 'confirmationRequired']);
    if (!Object.keys(changes).length) throw new BadRequestException('Укажите хотя бы одно поле для исправления.');

    return this.db.transaction(async manager => {
      const absence = await manager.findOne(Absence, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!absence) throw new NotFoundException('Запись отсутствия не найдена.');
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
        newValues: { ...this.snapshot(updated, patch), universityId: updated.universityId, reason: dto.reason.trim() },
      }));
      return {
        ...this.absenceSnapshot(updated),
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        studentEmail: student.email,
      };
    });
  }

  async correctAttendance(id: string, dto: PlatformAttendanceCorrectionDto) {
    const access = await this.platform.require('student-data.write');
    this.assertReason(dto.reason);
    const changes = this.pickChanges<MutableAttendanceField>(dto, ['status', 'comment']);
    if (!Object.keys(changes).length) throw new BadRequestException('Укажите хотя бы одно поле для исправления.');

    return this.db.transaction(async manager => {
      const record = await manager.findOne(AttendanceRecord, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!record) throw new NotFoundException('Запись посещаемости не найдена.');
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
        newValues: { ...this.snapshot(updated, patch), universityId: updated.universityId, reason: dto.reason.trim() },
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
