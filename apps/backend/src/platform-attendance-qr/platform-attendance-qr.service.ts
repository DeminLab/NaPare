import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AttendanceQrSession } from '../absences/entities/attendance-qr-session.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { PlatformService } from '../platform/platform.service';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { PlatformAttendanceQrQueryDto, RevokeAttendanceQrDto } from './platform-attendance-qr.dto';

type RequestAuditContext = { ip?: string; userAgent?: string };

@Injectable()
export class PlatformAttendanceQrService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async list(query: PlatformAttendanceQrQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('attendance-qr.read');
    if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
    const now = new Date();
    const qb = this.db.getRepository(AttendanceQrSession).createQueryBuilder('session')
      .innerJoin(University, 'un', 'un.id = session."universityId"')
      .innerJoin(Lesson, 'lesson', 'lesson.id = session."lessonId" AND lesson."universityId" = session."universityId"')
      .leftJoin(Group, 'g', 'g.id = lesson."groupId" AND g."universityId" = session."universityId"')
      .leftJoin(User, 'creator', 'creator.id = session."createdById"')
      .where('1 = 1');
    if (query.universityId) qb.andWhere('session."universityId" = :universityId', { universityId: query.universityId });
    else if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('session."universityId" IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    const status = query.status ?? 'active';
    if (status === 'active') qb.andWhere('session."revokedAt" IS NULL AND session."expiresAt" > :now', { now });
    if (status === 'expired') qb.andWhere('session."revokedAt" IS NULL AND session."expiresAt" <= :now', { now });
    if (status === 'revoked') qb.andWhere('session."revokedAt" IS NOT NULL');
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(session.id::text ILIKE :q ESCAPE E'\\\\' OR session.\"lessonId\"::text ILIKE :q ESCAPE E'\\\\' OR un.name ILIKE :q ESCAPE E'\\\\' OR lesson.subject ILIKE :q ESCAPE E'\\\\' OR COALESCE(g.name, lesson.\"groupId\"::text) ILIKE :q ESCAPE E'\\\\' OR COALESCE(creator.email, '') ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', creator.\"firstName\", creator.\"lastName\") ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
    const total = await qb.clone().getCount();
    const rows = await qb.select('session.id', 'id').addSelect('session."universityId"', 'universityId').addSelect('un.name', 'universityName')
      .addSelect('session."lessonId"', 'lessonId').addSelect('lesson.subject', 'subject').addSelect('lesson."groupId"', 'groupId')
      .addSelect('COALESCE(g.name, lesson."groupName", lesson."groupId"::text)', 'groupName').addSelect('lesson."teacherName"', 'teacherName')
      .addSelect('session."createdById"', 'createdById').addSelect("concat_ws(' ', creator.\"firstName\", creator.\"lastName\")", 'createdByName')
      .addSelect('session."createdAt"', 'createdAt').addSelect('session."expiresAt"', 'expiresAt').addSelect('session."revokedAt"', 'revokedAt')
      .addSelect("CASE WHEN session.\"revokedAt\" IS NOT NULL THEN 'revoked' WHEN session.\"expiresAt\" <= :now THEN 'expired' ELSE 'active' END", 'status')
      .orderBy('session."createdAt"', 'DESC').addOrderBy('session.id', 'DESC').skip((query.page - 1) * query.limit).take(query.limit).getRawMany();
    await this.audit(this.db.manager, access.actorId, 'platform.attendance_qr.search', 'attendance_qr_session', 'search', {
      universityId: query.universityId ?? null, status, queryEntered: Boolean(query.q?.trim()), page: query.page, limit: query.limit,
      resultCount: rows.length, total, sessionIds: rows.map(row => row.id),
    }, context);
    return toPaginatedResponse(rows, total, query);
  }

  async revoke(id: string, dto: RevokeAttendanceQrDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('attendance-qr.revoke');
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
    return this.db.transaction(async manager => {
      const session = await manager.findOne(AttendanceQrSession, {
        where: { id },
        select: { id: true, universityId: true, lessonId: true, createdById: true, expiresAt: true, revokedAt: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new NotFoundException('QR-сессия не найдена.');
      this.platform.assertUniversityScope(access, session.universityId);
      if (session.revokedAt) throw new ConflictException('QR-сессия уже отозвана.');
      const revokedAt = new Date();
      if (session.expiresAt <= revokedAt) throw new ConflictException('Срок QR-сессии уже истёк; отзывать её не требуется.');
      const lesson = await manager.findOne(Lesson, { where: { id: session.lessonId, universityId: session.universityId } });
      if (!lesson) throw new ConflictException('Связь QR-сессии с занятием больше не действительна.');
      await manager.update(AttendanceQrSession, id, { revokedAt });
      await this.audit(manager, access.actorId, 'platform.attendance_qr.revoked', 'attendance_qr_session', id, {
        universityId: session.universityId, lessonId: lesson.id, groupId: lesson.groupId, createdById: session.createdById,
        status: 'revoked', revokedAt: revokedAt.toISOString(), reason, result: 'revoked',
      }, context, { universityId: session.universityId, lessonId: lesson.id, groupId: lesson.groupId, status: 'active' });
      return { id, changed: true, status: 'revoked', revokedAt };
    });
  }

  private async audit(manager: EntityManager, actorId: string, action: string, entity: string, entityId: string, newValues: JsonObject, context: RequestAuditContext = {}, oldValues?: JsonObject) {
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId, action, entity, entityId, ...(oldValues ? { oldValues } : {}), newValues,
      ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }
}
