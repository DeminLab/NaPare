import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { DiscussionMessage } from '../pair-space/entities/discussion-message.entity';
import { PairSpace } from '../pair-space/entities/pair-space.entity';
import { Lesson } from '../schedule/entities/lesson.entity';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { PlatformService } from '../platform/platform.service';
import { PlatformDiscussionModerationDto, PlatformDiscussionPatchDto, PlatformDiscussionQueryDto } from './platform-discussions.dto';

type RequestAuditContext = { ip?: string; userAgent?: string };
type DiscussionSummary = { id: string; pairSpaceId: string; lessonId: string; universityId: string; universityName: string; subject: string; lessonDate: Date; pairNumber: number; groupId: string; authorId: string; authorName: string; authorEmail: string; textPreview: string; parentId: string | null; moderationState: 'visible' | 'hidden'; createdAt: Date; updatedAt: Date };
type DiscussionDetail = DiscussionSummary & { text: string; moderationReason: string | null; moderatedBy: string | null; moderatedAt: Date | null };

@Injectable()
export class PlatformDiscussionsService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async messages(query: PlatformDiscussionQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('discussion-data.read');
    const qb = this.summaryQuery();
    this.applyFilters(qb, query, access);
    const total = await qb.clone().getCount();
    const data = await qb.orderBy('message.createdAt', 'DESC').addOrderBy('message.id', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getRawMany<DiscussionSummary>();
    await this.auditRead('platform.discussion_message.search', 'search', access.actorId, {
      recordIds: data.map(row => row.id), universityIds: [...new Set(data.map(row => row.universityId))],
      ...(query.universityId ? { universityId: query.universityId } : {}), ...(query.authorId ? { authorId: query.authorId } : {}),
      queryEntered: Boolean(query.q?.trim()), state: query.state ?? 'any', page: query.page, limit: query.limit, resultCount: data.length, total,
    }, context);
    return toPaginatedResponse(data, total, query);
  }

  async message(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('discussion-data.read');
    const detail = await this.summaryQuery(true).where('message.id = :id', { id }).getRawOne<DiscussionDetail>();
    if (!detail) throw new NotFoundException('Сообщение обсуждения не найдено.');
    this.platform.assertUniversityScope(access, detail.universityId);
    await this.auditRead('platform.discussion_message.viewed', detail.id, access.actorId, {
      targetUserId: detail.authorId, universityId: detail.universityId, pairSpaceId: detail.pairSpaceId, result: 'viewed',
    }, context);
    return detail;
  }

  async patchMessage(id: string, dto: PlatformDiscussionPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('discussion-data.write');
    this.assertReason(dto.reason);
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Текст сообщения не может быть пустым.');
    return this.db.transaction(async manager => {
      const message = await manager.findOne(DiscussionMessage, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!message) throw new NotFoundException('Сообщение обсуждения не найдено.');
      const resource = await this.assertMessageContext(manager, message);
      this.platform.assertUniversityScope(access, resource.universityId);
      if (message.text === text) throw new ConflictException('Новый текст совпадает с текущим.');
      const oldValues: JsonObject = { text: message.text, moderationState: message.moderationState };
      message.text = text;
      const updated = await manager.save(DiscussionMessage, message);
      await this.auditMutation(manager, access.actorId, updated, resource.universityId, oldValues,
        { text: updated.text, moderationState: updated.moderationState, adminReason: dto.reason.trim(), result: 'updated' }, context);
      return { id: updated.id, text: updated.text, moderationState: updated.moderationState, updatedAt: updated.updatedAt };
    });
  }

  async moderateMessage(id: string, dto: PlatformDiscussionModerationDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('discussion-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const message = await manager.findOne(DiscussionMessage, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!message) throw new NotFoundException('Сообщение обсуждения не найдено.');
      const resource = await this.assertMessageContext(manager, message);
      this.platform.assertUniversityScope(access, resource.universityId);
      if (message.moderationState === dto.state && message.moderationReason === dto.reason.trim()) throw new ConflictException('Сообщение уже имеет это состояние и причину.');
      const oldValues: JsonObject = { moderationState: message.moderationState, moderationReason: message.moderationReason, moderatedBy: message.moderatedBy, moderatedAt: message.moderatedAt?.toISOString() ?? null };
      message.moderationState = dto.state;
      message.moderationReason = dto.reason.trim();
      message.moderatedBy = access.actorId;
      message.moderatedAt = new Date();
      const updated = await manager.save(DiscussionMessage, message);
      await this.auditMutation(manager, access.actorId, updated, resource.universityId, oldValues,
        { moderationState: updated.moderationState, moderationReason: updated.moderationReason, moderatedBy: updated.moderatedBy, moderatedAt: updated.moderatedAt?.toISOString() ?? null, adminReason: dto.reason.trim(), result: dto.state === 'hidden' ? 'hidden' : 'restored' }, context);
      return { id: updated.id, moderationState: updated.moderationState, moderationReason: updated.moderationReason, moderatedAt: updated.moderatedAt };
    });
  }

  private summaryQuery(includeText = false): SelectQueryBuilder<DiscussionMessage> {
    const qb = this.db.getRepository(DiscussionMessage).createQueryBuilder('message')
      .innerJoin(PairSpace, 'pairSpace', 'pairSpace.id = message.pairSpaceId')
      .innerJoin(University, 'university', 'university.id = pairSpace.universityId')
      .innerJoin(Lesson, 'lesson', 'lesson.id = pairSpace.lessonId AND lesson.universityId = pairSpace.universityId')
      .leftJoin(User, 'author', 'author.id = message.userId')
      .select('message.id', 'id').addSelect('message.pairSpaceId', 'pairSpaceId')
      .addSelect('pairSpace.lessonId', 'lessonId').addSelect('pairSpace.universityId', 'universityId')
      .addSelect('university.name', 'universityName').addSelect('lesson.subject', 'subject')
      .addSelect('lesson.startDate', 'lessonDate').addSelect('lesson.pairNumber', 'pairNumber')
      .addSelect('lesson.groupId', 'groupId').addSelect('message.userId', 'authorId')
      .addSelect("concat_ws(' ', author.firstName, author.lastName)", 'authorName')
      .addSelect('author.email', 'authorEmail').addSelect('LEFT(message.text, 180)', 'textPreview')
      .addSelect('message.parentId', 'parentId').addSelect('message.moderationState', 'moderationState')
      .addSelect('message.createdAt', 'createdAt').addSelect('message.updatedAt', 'updatedAt');
    if (includeText) qb.addSelect('message.text', 'text').addSelect('message.moderationReason', 'moderationReason')
      .addSelect('message.moderatedBy', 'moderatedBy').addSelect('message.moderatedAt', 'moderatedAt');
    return qb;
  }

  private applyFilters(qb: SelectQueryBuilder<DiscussionMessage>, query: PlatformDiscussionQueryDto, access: Awaited<ReturnType<PlatformService['access']>>): void {
    if (query.universityId) {
      if (access.owner || access.universityIds === null || access.universityIds.length > 0) {
        this.platform.assertUniversityScope(access, query.universityId);
      }
      qb.andWhere('pairSpace.universityId = :universityId', { universityId: query.universityId });
    }
    if (!access.owner && access.universityIds !== null) {
      if (!access.universityIds.length) qb.andWhere('1 = 0');
      else qb.andWhere('pairSpace.universityId IN (:...allowedUniversityIds)', { allowedUniversityIds: access.universityIds });
    }
    if (query.authorId) qb.andWhere('message.userId = :authorId', { authorId: query.authorId });
    if (query.state) qb.andWhere('message.moderationState = :state', { state: query.state });
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere("(message.id::text ILIKE :q ESCAPE E'\\\\' OR message.userId::text ILIKE :q ESCAPE E'\\\\' OR message.text ILIKE :q ESCAPE E'\\\\' OR author.email ILIKE :q ESCAPE E'\\\\' OR concat_ws(' ', author.firstName, author.lastName) ILIKE :q ESCAPE E'\\\\' OR lesson.subject ILIKE :q ESCAPE E'\\\\')", { q: pattern });
    }
  }

  private async assertMessageContext(manager: EntityManager, message: DiscussionMessage): Promise<PairSpace> {
    const pairSpace = await manager.findOne(PairSpace, { where: { id: message.pairSpaceId }, lock: { mode: 'pessimistic_read' } });
    if (!pairSpace || !await manager.getRepository(University).existsBy({ id: pairSpace.universityId })) throw new BadRequestException('Сообщение не связано с действующим университетом.');
    const lesson = await manager.findOne(Lesson, { where: { id: pairSpace.lessonId, universityId: pairSpace.universityId }, select: ['id'] });
    if (!lesson) throw new BadRequestException('Пространство пары не связано с занятием своего университета.');
    return pairSpace;
  }

  private async auditRead(action: string, entityId: string, actorId: string, values: JsonObject, context: RequestAuditContext): Promise<void> {
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({
      userId: actorId, action, entity: 'personal_data.discussion_message', entityId, newValues: values,
      ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private async auditMutation(manager: EntityManager, actorId: string, message: DiscussionMessage, universityId: string, oldValues: JsonObject, newValues: JsonObject, context: RequestAuditContext): Promise<void> {
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId, action: `platform.discussion_message.${newValues.result}`, entity: 'personal_data.discussion_message', entityId: message.id,
      oldValues, newValues: { ...newValues, targetUserId: message.userId, universityId, pairSpaceId: message.pairSpaceId },
      ...(context.ip ? { ip: context.ip } : {}), ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private assertReason(reason: string): void {
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину (не менее 3 символов).');
  }
}
