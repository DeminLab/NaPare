import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { Homework } from '../pair-space/entities/homework.entity';
import { HomeworkSubmission } from '../pair-space/entities/homework-submission.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformService } from '../platform/platform.service';
import { PlatformHomeworkSubmissionPatchDto, PlatformHomeworkSubmissionQueryDto } from './platform-homework.dto';

type RequestAuditContext = { ip?: string; userAgent?: string };
type SubmissionSummary = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityId: string;
  universityName: string;
  homeworkId: string;
  homeworkTitle: string;
  subject: string;
  date: Date;
  pairNumber: number;
  status: string;
  submittedAt: Date | null;
  updatedAt: Date;
};
type SubmissionDetail = SubmissionSummary & { fileUrl: string | null; comment: string | null; createdAt: Date };

@Injectable()
export class PlatformHomeworkService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async submissions(query: PlatformHomeworkSubmissionQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('homework-data.read');
    if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
    return this.db.transaction(async manager => {
      const qb = this.summaryQuery(manager);
      this.applyUniversityScope(qb, access);
      this.applyFilters(qb, query);
      const total = await qb.clone().getCount();
      const rows = await qb.orderBy('submission.updatedAt', 'DESC').addOrderBy('submission.id', 'DESC')
        .skip((query.page - 1) * query.limit).take(query.limit).getRawMany<SubmissionSummary>();
      await this.auditRead(manager, 'platform.homework_submission.search', 'search', access.actorId, {
        recordIds: rows.map(row => row.id), universityIds: [...new Set(rows.map(row => row.universityId))],
        ...(query.universityId ? { universityId: query.universityId } : {}), status: query.status ?? 'any',
        queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit, resultCount: rows.length, total,
      }, context);
      return toPaginatedResponse(rows, total, query);
    });
  }

  async submission(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('homework-data.read');
    return this.db.transaction(async manager => {
      const detail = await this.summaryQuery(manager, true).where('submission.id = :id', { id }).getRawOne<SubmissionDetail>();
      if (!detail) throw new NotFoundException('Сдача домашнего задания не найдена.');
      this.platform.assertUniversityScope(access, detail.universityId);
      await this.auditRead(manager, 'platform.homework_submission.viewed', detail.id, access.actorId, {
        targetUserId: detail.studentId, universityId: detail.universityId, homeworkId: detail.homeworkId, result: 'viewed',
      }, context);
      return detail;
    });
  }

  async patchSubmission(id: string, dto: PlatformHomeworkSubmissionPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('homework-data.write');
    this.assertReason(dto.reason);
    const hasMutableValue = dto.status !== undefined || dto.submittedAt !== undefined || dto.fileUrl !== undefined || dto.comment !== undefined;
    if (!hasMutableValue) throw new BadRequestException('Укажите хотя бы одно поле для исправления.');

    return this.db.transaction(async manager => {
      const submission = await manager.findOne(HomeworkSubmission, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!submission) throw new NotFoundException('Сдача домашнего задания не найдена.');
      const resource = await this.assertSubmissionContext(manager, submission, access);

      const nextStatus = dto.status ?? submission.status;
      let nextSubmittedAt: Date | null = dto.submittedAt === undefined
        ? submission.submittedAt
        : dto.submittedAt === null ? null : new Date(dto.submittedAt);
      if (dto.status === 'not_submitted' && dto.submittedAt === undefined) nextSubmittedAt = null;
      if (nextStatus === 'submitted' && nextSubmittedAt === null) {
        if (dto.status === 'submitted' && dto.submittedAt === undefined) nextSubmittedAt = new Date();
        else throw new BadRequestException('Для сданного задания укажите дату сдачи.');
      }
      if (nextStatus === 'not_submitted' && nextSubmittedAt !== null) {
        throw new BadRequestException('Для несданного задания дата сдачи должна быть пустой.');
      }

      const nextFileUrl = dto.fileUrl === undefined ? submission.fileUrl : this.normalizeNullableText(dto.fileUrl);
      const nextComment = dto.comment === undefined ? submission.comment : this.normalizeNullableText(dto.comment);
      const oldValues: JsonObject = {
        status: submission.status,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
        fileUrl: this.sanitizeAuditFileUrl(submission.fileUrl),
        comment: submission.comment,
      };
      const newValues: JsonObject = {
        status: nextStatus,
        submittedAt: nextSubmittedAt?.toISOString() ?? null,
        fileUrl: this.sanitizeAuditFileUrl(nextFileUrl),
        comment: nextComment,
      };
      const unchanged = submission.status === nextStatus
        && (submission.submittedAt?.getTime() ?? null) === (nextSubmittedAt?.getTime() ?? null)
        && submission.fileUrl === nextFileUrl
        && submission.comment === nextComment;
      if (unchanged) throw new ConflictException('Исправленные значения совпадают с текущими.');

      submission.status = nextStatus;
      submission.submittedAt = nextSubmittedAt;
      submission.fileUrl = nextFileUrl;
      submission.comment = nextComment;
      const updated = await manager.save(HomeworkSubmission, submission);
      await manager.save(AuditLog, manager.create(AuditLog, {
        userId: access.actorId,
        action: 'platform.homework_submission.corrected',
        entity: 'learning_data.homework_submission',
        entityId: updated.id,
        oldValues,
        newValues: {
          ...newValues,
          reason: dto.reason.trim(),
          targetUserId: updated.studentId,
          homeworkId: updated.homeworkId,
          universityId: resource.universityId,
          result: 'corrected',
        },
        ...(context.ip ? { ip: context.ip } : {}),
        ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
      }));
      return {
        id: updated.id,
        status: updated.status,
        submittedAt: updated.submittedAt,
        fileUrl: updated.fileUrl,
        comment: updated.comment,
        updatedAt: updated.updatedAt,
      };
    });
  }

  private summaryQuery(manager: EntityManager, includeContent = false): SelectQueryBuilder<HomeworkSubmission> {
    const qb = manager.getRepository(HomeworkSubmission).createQueryBuilder('submission')
      .innerJoin(Homework, 'homework', 'homework.id = submission.homeworkId')
      .innerJoin(PairSpace, 'pairSpace', 'pairSpace.id = homework.pairSpaceId')
      .innerJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
      .innerJoin(University, 'university', 'university.id = pairSpace.universityId')
      .innerJoin(User, 'student', 'student.id = submission.studentId')
      .select('submission.id', 'id')
      .addSelect('submission.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail')
      .addSelect('pairSpace.universityId', 'universityId')
      .addSelect('university.name', 'universityName')
      .addSelect('homework.id', 'homeworkId')
      .addSelect('homework.title', 'homeworkTitle')
      .addSelect('lesson.subject', 'subject')
      .addSelect('lesson.startDate', 'date')
      .addSelect('lesson.pairNumber', 'pairNumber')
      .addSelect('submission.status', 'status')
      .addSelect('submission.submittedAt', 'submittedAt')
      .addSelect('submission.updatedAt', 'updatedAt');
    if (includeContent) qb.addSelect('submission.fileUrl', 'fileUrl').addSelect('submission.comment', 'comment')
      .addSelect('submission.createdAt', 'createdAt');
    return qb;
  }

  private applyFilters(qb: SelectQueryBuilder<HomeworkSubmission>, query: PlatformHomeworkSubmissionQueryDto): void {
    if (query.startDate && query.endDate && new Date(query.startDate) > new Date(query.endDate)) {
      throw new BadRequestException('Начало периода позже его окончания.');
    }
    if (query.universityId) qb.andWhere('pairSpace.universityId = :universityId', { universityId: query.universityId });
    if (query.status) qb.andWhere('submission.status = :status', { status: query.status });
    if (query.startDate) qb.andWhere('submission.submittedAt >= :startDate', { startDate: new Date(query.startDate) });
    if (query.endDate) qb.andWhere('submission.submittedAt <= :endDate', { endDate: new Date(query.endDate) });
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(submission.id::text ILIKE :q ESCAPE E'\\\\' OR submission.studentId::text ILIKE :q ESCAPE E'\\\\' OR student.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', student.firstName, student.lastName) ILIKE :q ESCAPE E'\\\\' OR homework.id::text ILIKE :q ESCAPE E'\\\\' OR homework.title ILIKE :q ESCAPE E'\\\\' OR COALESCE(submission.comment, '') ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
  }

  private applyUniversityScope(qb: SelectQueryBuilder<HomeworkSubmission>, access: Awaited<ReturnType<PlatformService['access']>>): void {
    if (access.owner || access.universityIds === null) return;
    if (!access.universityIds.length) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere('pairSpace.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
  }

  private async assertSubmissionContext(manager: EntityManager, submission: HomeworkSubmission, access: Awaited<ReturnType<PlatformService['access']>>): Promise<{ universityId: string }> {
    const homework = await manager.findOne(Homework, { where: { id: submission.homeworkId }, lock: { mode: 'pessimistic_read' } });
    if (!homework) throw new BadRequestException('Сдача не связана с существующим заданием.');
    const pairSpace = await manager.findOne(PairSpace, { where: { id: homework.pairSpaceId }, lock: { mode: 'pessimistic_read' } });
    if (!pairSpace) throw new BadRequestException('Задание не связано с существующим пространством пары.');
    const lesson = await manager.findOne(Lesson, { where: { id: pairSpace.lessonId, universityId: pairSpace.universityId }, lock: { mode: 'pessimistic_read' } });
    if (!lesson) throw new BadRequestException('Пространство пары не связано с занятием того же университета.');
    const university = await manager.findOne(University, { where: { id: pairSpace.universityId }, select: ['id'], lock: { mode: 'pessimistic_read' } });
    if (!university) throw new BadRequestException('Университет сдачи не найден.');
    this.platform.assertUniversityScope(access, university.id);
    const student = await manager.findOne(User, { where: { id: submission.studentId }, select: ['id'], lock: { mode: 'pessimistic_read' } });
    if (!student) throw new BadRequestException('Пользователь сдачи не найден.');
    return { universityId: university.id };
  }

  private async auditRead(manager: EntityManager, action: string, entityId: string, actorId: string, values: JsonObject, context: RequestAuditContext): Promise<void> {
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId, action, entity: 'learning_data.homework_submission', entityId, newValues: values,
      ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private normalizeNullableText(value: string | null): string | null {
    const normalized = value?.trim() ?? '';
    return normalized || null;
  }

  private sanitizeAuditFileUrl(value: string | null): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.username) url.username = '[redacted]';
      if (url.password) url.password = '[redacted]';
      if (url.search) url.search = '?[redacted]';
      if (url.hash) url.hash = '#[redacted]';
      return url.toString();
    } catch {
      return /[?#]/.test(value) ? `${value.split(/[?#]/, 1)[0]}?[redacted]` : value;
    }
  }

  private assertReason(reason: string): void {
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
  }
}
