import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { FileAttachment } from '../pair-space/entities/file-attachment.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { PlatformService } from '../platform/platform.service';
import { PlatformAttachmentActionDto, PlatformAttachmentQueryDto } from './platform-attachments.dto';

type AuditContext = { ip?: string; userAgent?: string };
type AttachmentRow = {
  id: string; pairSpaceId: string; lessonId: string; universityId: string; universityName: string;
  subject: string; groupId: string; groupName: string; uploaderId: string; uploaderName: string;
  uploaderEmail: string; fileName: string; fileType: string; size: number; createdAt: Date | string;
  revokedAt: Date | string | null; revokedBy: string | null; revokeReason: string | null; sourceUrl: string;
};

@Injectable()
export class PlatformAttachmentsService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async list(query: PlatformAttachmentQueryDto, context: AuditContext = {}) {
    const access = await this.platform.require('attachments-data.read');
    const result = await this.db.transaction(async manager => {
      const qb = this.summaryQuery(manager);
      this.applyFilters(qb, query);
      if (query.universityId) this.platform.assertUniversityScope(access, query.universityId);
      if (!access.owner && access.universityIds !== null) {
        if (!access.universityIds.length) qb.andWhere('1 = 0');
        else qb.andWhere('pairSpace.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
      }
      const total = await qb.clone().getCount();
      const rows = await qb.orderBy('attachment.createdAt', 'DESC').addOrderBy('attachment.id', 'DESC')
        .skip((query.page - 1) * query.limit).take(query.limit).getRawMany<AttachmentRow>();
      const data = rows.map(row => this.toPublicRow(row));
      await this.audit(manager, {
        userId: access.actorId, action: 'platform.file_attachment.search', entity: 'file_attachment_search', entityId: 'search',
        newValues: {
          actorId: access.actorId, queryEntered: Boolean(query.q?.trim()),
          filters: { universityId: query.universityId ?? null, status: query.status ?? 'active' },
          page: query.page, limit: query.limit, resultCount: data.length, total, resultAttachmentIds: data.map(item => item.id),
          universityIds: [...new Set(data.map(item => item.universityId))],
        },
      }, context);
      return toPaginatedResponse(data, total, query);
    });
    return result;
  }

  async detail(id: string, context: AuditContext = {}) {
    const access = await this.platform.require('attachments-data.read');
    return this.db.transaction(async manager => {
      const row = await this.summaryQuery(manager).where('attachment.id = :id', { id }).getRawOne<AttachmentRow>();
      if (!row) throw new NotFoundException('Вложение PairSpace не найдено.');
      this.platform.assertUniversityScope(access, row.universityId);
      const item = this.toPublicRow(row);
      await this.audit(manager, {
        userId: access.actorId, action: 'platform.file_attachment.viewed', entity: 'file_attachment', entityId: id,
        newValues: { actorId: access.actorId, attachmentId: id, pairSpaceId: row.pairSpaceId, lessonId: row.lessonId, universityId: row.universityId, groupId: row.groupId, uploaderId: row.uploaderId, result: 'viewed' },
      }, context);
      return item;
    });
  }

  async revoke(id: string, dto: PlatformAttachmentActionDto, context: AuditContext = {}) {
    return this.changeState(id, dto, 'revoke', context);
  }

  async restore(id: string, dto: PlatformAttachmentActionDto, context: AuditContext = {}) {
    return this.changeState(id, dto, 'restore', context);
  }

  private async changeState(id: string, dto: PlatformAttachmentActionDto, action: 'revoke' | 'restore', context: AuditContext) {
    const access = await this.platform.require('attachments-data.write');
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
    return this.db.transaction(async manager => {
      const attachment = await manager.findOne(FileAttachment, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!attachment) throw new NotFoundException('Вложение PairSpace не найдено.');
      const resource = await this.assertAttachmentContext(manager, attachment);
      this.platform.assertUniversityScope(access, resource.universityId);
      if (action === 'revoke' && attachment.revokedAt) throw new ConflictException('Вложение уже отозвано.');
      if (action === 'restore' && !attachment.revokedAt) throw new ConflictException('Вложение уже доступно пользователям.');
      const previous = attachment.revokedAt ? 'revoked' : 'active';
      if (action === 'revoke') {
        attachment.revokedAt = new Date();
        attachment.revokedBy = access.actorId;
        attachment.revokeReason = reason;
      } else {
        attachment.revokedAt = null;
        attachment.revokedBy = null;
        attachment.revokeReason = null;
      }
      const updated = await manager.save(FileAttachment, attachment);
      await this.audit(manager, {
        userId: access.actorId,
        action: action === 'revoke' ? 'platform.file_attachment.revoked' : 'platform.file_attachment.restored',
        entity: 'file_attachment', entityId: id,
        oldValues: { status: previous, pairSpaceId: resource.pairSpaceId, lessonId: resource.lessonId, universityId: resource.universityId, groupId: resource.groupId },
        newValues: { status: action === 'revoke' ? 'revoked' : 'active', reason, actorId: access.actorId, attachmentId: id, pairSpaceId: resource.pairSpaceId, lessonId: resource.lessonId, universityId: resource.universityId, groupId: resource.groupId, uploaderId: updated.uploadedBy },
      }, context);
      const row = await this.summaryQuery(manager).where('attachment.id = :id', { id }).getRawOne<AttachmentRow>();
      if (!row) throw new NotFoundException('Вложение PairSpace не найдено после изменения.');
      return this.toPublicRow(row);
    });
  }

  private summaryQuery(manager: EntityManager): SelectQueryBuilder<FileAttachment> {
    return manager.getRepository(FileAttachment).createQueryBuilder('attachment')
      .innerJoin(PairSpace, 'pairSpace', 'pairSpace.id = attachment.pairSpaceId')
      .innerJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
      .innerJoin(University, 'university', 'university.id = pairSpace.universityId')
      .innerJoin(Group, 'attachmentGroup', 'attachmentGroup.id = lesson.groupId AND attachmentGroup.universityId = lesson.universityId')
      .innerJoin(User, 'uploader', 'uploader.id = attachment.uploadedBy')
      .select('attachment.id', 'id')
      .addSelect('pairSpace.id', 'pairSpaceId')
      .addSelect('lesson.id', 'lessonId')
      .addSelect('pairSpace.universityId', 'universityId')
      .addSelect('university.name', 'universityName')
      .addSelect('lesson.subject', 'subject')
      .addSelect('attachmentGroup.id', 'groupId')
      .addSelect('attachmentGroup.name', 'groupName')
      .addSelect('uploader.id', 'uploaderId')
      .addSelect("concat_ws(' ', uploader.firstName, uploader.lastName)", 'uploaderName')
      .addSelect('uploader.email', 'uploaderEmail')
      .addSelect('attachment.fileName', 'fileName')
      .addSelect('attachment.fileType', 'fileType')
      .addSelect('attachment.size', 'size')
      .addSelect('attachment.createdAt', 'createdAt')
      .addSelect('attachment.revokedAt', 'revokedAt')
      .addSelect('attachment.revokedBy', 'revokedBy')
      .addSelect('attachment.revokeReason', 'revokeReason')
      .addSelect('attachment.fileUrl', 'sourceUrl');
  }

  private applyFilters(qb: SelectQueryBuilder<FileAttachment>, query: PlatformAttachmentQueryDto): void {
    if (query.universityId) qb.andWhere('pairSpace.universityId = :universityId', { universityId: query.universityId });
    if (query.status === 'active') qb.andWhere('attachment.revokedAt IS NULL');
    if (query.status === 'revoked') qb.andWhere('attachment.revokedAt IS NOT NULL');
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(attachment.id::text ILIKE :q ESCAPE E'\\\\' OR attachment.pairSpaceId::text ILIKE :q ESCAPE E'\\\\' OR lesson.id::text ILIKE :q ESCAPE E'\\\\' OR attachmentGroup.name ILIKE :q ESCAPE E'\\\\' OR lesson.subject ILIKE :q ESCAPE E'\\\\' OR attachment.fileName ILIKE :q ESCAPE E'\\\\' OR uploader.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', uploader.firstName, uploader.lastName) ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
  }

  private async assertAttachmentContext(manager: EntityManager, attachment: FileAttachment): Promise<{ pairSpaceId: string; lessonId: string; universityId: string; groupId: string }> {
    const pairSpace = await manager.findOne(PairSpace, { where: { id: attachment.pairSpaceId }, select: ['id', 'lessonId', 'universityId'], lock: { mode: 'pessimistic_read' } });
    if (!pairSpace) throw new BadRequestException('Вложение не связано с существующим пространством пары.');
    const lesson = await manager.findOne(Lesson, { where: { id: pairSpace.lessonId, universityId: pairSpace.universityId }, select: ['id', 'universityId', 'groupId'], lock: { mode: 'pessimistic_read' } });
    if (!lesson) throw new BadRequestException('Пространство пары не связано с занятием того же университета.');
    const university = await manager.findOne(University, { where: { id: pairSpace.universityId }, select: ['id'], lock: { mode: 'pessimistic_read' } });
    if (!university) throw new BadRequestException('Университет вложения не найден.');
    const group = await manager.findOne(Group, { where: { id: lesson.groupId, universityId: lesson.universityId }, select: ['id'], lock: { mode: 'pessimistic_read' } });
    if (!group) throw new BadRequestException('Занятие не связано с группой того же университета.');
    const uploader = await manager.findOne(User, { where: { id: attachment.uploadedBy }, select: ['id'], lock: { mode: 'pessimistic_read' } });
    if (!uploader) throw new BadRequestException('Загрузивший пользователь не найден.');
    return { pairSpaceId: pairSpace.id, lessonId: lesson.id, universityId: university.id, groupId: group.id };
  }

  private toPublicRow(row: AttachmentRow) {
    return {
      id: row.id, pairSpaceId: row.pairSpaceId, lessonId: row.lessonId, universityId: row.universityId,
      universityName: row.universityName, subject: row.subject, groupId: row.groupId, groupName: row.groupName,
      uploaderId: row.uploaderId, uploaderName: row.uploaderName, uploaderEmail: row.uploaderEmail,
      fileName: row.fileName, fileType: row.fileType, size: Number(row.size),
      createdAt: asIso(row.createdAt), status: row.revokedAt ? 'revoked' as const : 'active' as const,
      revokedAt: row.revokedAt ? asIso(row.revokedAt) : null, revokedBy: row.revokedBy,
      revokeReason: row.revokeReason, fileLocation: sanitizeFileLocation(row.sourceUrl),
    };
  }

  private async audit(manager: EntityManager, entry: Partial<AuditLog> & Pick<AuditLog, 'userId' | 'action' | 'entity' | 'entityId'>, context: AuditContext): Promise<void> {
    await manager.save(AuditLog, manager.create(AuditLog, {
      ...entry,
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }
}

function sanitizeFileLocation(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.origin}${url.pathname}`.slice(0, 1000);
  } catch {
    return null;
  }
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
