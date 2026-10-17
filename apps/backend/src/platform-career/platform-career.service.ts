import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { AuditLog } from '../common/entities/audit-log.entity';
import { JsonObject } from '../common/types/json-value.type';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { PlatformService } from '../platform/platform.service';
import { University } from '../users/entities/university.entity';
import { User } from '../users/entities/user.entity';
import { CareerAdmission, CareerProfile } from '../career/career.entities';
import {
  PlatformCareerAdmissionPatchDto,
  PlatformCareerAdmissionQueryDto,
  PlatformCareerDecisionDto,
  PlatformCareerProfilePatchDto,
  PlatformCareerProfileQueryDto,
} from './platform-career.dto';

type ProfileRow = { id: string; studentId: string; studentName: string; studentEmail: string; universityId: string; universityName: string; headline: string; about: string; skills: string[]; verification: string; createdAt: Date; updatedAt: Date };
type AdmissionRow = { id: string; studentId: string; studentName: string; studentEmail: string; universityId: string; universityName: string; skill: string; evidence: string; state: string; reason: string; basis: string; createdAt: Date; updatedAt: Date };
type RequestAuditContext = { ip?: string; userAgent?: string };

@Injectable()
export class PlatformCareerService {
  constructor(private readonly db: DataSource, private readonly platform: PlatformService) {}

  async profiles(query: PlatformCareerProfileQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const qb = this.db.getRepository(CareerProfile).createQueryBuilder('profile')
      .leftJoin(User, 'student', 'student.id = profile.studentId')
      .innerJoin(University, 'university', 'university.id = profile.universityId')
      .select('profile.id', 'id').addSelect('profile.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('profile.universityId', 'universityId')
      .addSelect('university.name', 'universityName').addSelect('profile.headline', 'headline')
      .addSelect('profile.skills', 'skills')
      .addSelect('profile.verification', 'verification').addSelect('profile.createdAt', 'createdAt')
      .addSelect('profile.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('profile.universityId = :universityId', { universityId: query.universityId });
    if (query.verification) qb.andWhere('profile.verification = :verification', { verification: query.verification });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['profile.id::text', 'profile.studentId::text', 'student.email', "concat_ws(' ', student.firstName, student.lastName)", 'profile.headline', 'profile.about', 'profile.skills::text']);
    const [data, total] = await this.paginate<CareerProfile, ProfileRow>(qb, query.page, query.limit, 'profile.updatedAt', 'profile.id');
    await this.auditRead('career_profile', access.actorId, data, query, total, context);
    return toPaginatedResponse(data, total, query);
  }

  async admissions(query: PlatformCareerAdmissionQueryDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const qb = this.db.getRepository(CareerAdmission).createQueryBuilder('admission')
      .leftJoin(User, 'student', 'student.id = admission.studentId')
      .innerJoin(University, 'university', 'university.id = admission.universityId')
      .select('admission.id', 'id').addSelect('admission.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName')
      .addSelect('student.email', 'studentEmail').addSelect('admission.universityId', 'universityId')
      .addSelect('university.name', 'universityName').addSelect('admission.skill', 'skill')
      .addSelect('admission.state', 'state').addSelect('admission.basis', 'basis')
      .addSelect('admission.createdAt', 'createdAt').addSelect('admission.updatedAt', 'updatedAt');
    if (query.universityId) qb.andWhere('admission.universityId = :universityId', { universityId: query.universityId });
    if (query.state) qb.andWhere('admission.state = :state', { state: query.state });
    if (query.q?.trim()) this.applySearch(qb, query.q.trim(), ['admission.id::text', 'admission.studentId::text', 'student.email', "concat_ws(' ', student.firstName, student.lastName)", 'admission.skill', 'admission.evidence', 'admission.reason']);
    const [data, total] = await this.paginate<CareerAdmission, AdmissionRow>(qb, query.page, query.limit, 'admission.updatedAt', 'admission.id');
    await this.auditRead('career_admission', access.actorId, data, query, total, context);
    return toPaginatedResponse(data, total, query);
  }

  async profile(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const profile = await this.db.getRepository(CareerProfile).createQueryBuilder('profile')
      .leftJoin(User, 'student', 'student.id = profile.studentId')
      .innerJoin(University, 'university', 'university.id = profile.universityId')
      .select('profile.id', 'id').addSelect('profile.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName').addSelect('student.email', 'studentEmail')
      .addSelect('profile.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('profile.headline', 'headline').addSelect('profile.about', 'about').addSelect('profile.skills', 'skills')
      .addSelect('profile.verification', 'verification').addSelect('profile.createdAt', 'createdAt').addSelect('profile.updatedAt', 'updatedAt')
      .where('profile.id = :id', { id }).getRawOne<ProfileRow>();
    if (!profile) throw new NotFoundException('Карьерный профиль не найден.');
    await this.auditDetailRead('career_profile', access.actorId, profile.id, profile.studentId, profile.universityId, context);
    return profile;
  }

  async admission(id: string, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.read');
    const admission = await this.db.getRepository(CareerAdmission).createQueryBuilder('admission')
      .leftJoin(User, 'student', 'student.id = admission.studentId')
      .innerJoin(University, 'university', 'university.id = admission.universityId')
      .select('admission.id', 'id').addSelect('admission.studentId', 'studentId')
      .addSelect("concat_ws(' ', student.firstName, student.lastName)", 'studentName').addSelect('student.email', 'studentEmail')
      .addSelect('admission.universityId', 'universityId').addSelect('university.name', 'universityName')
      .addSelect('admission.skill', 'skill').addSelect('admission.evidence', 'evidence').addSelect('admission.state', 'state')
      .addSelect('admission.reason', 'reason').addSelect('admission.basis', 'basis')
      .addSelect('admission.createdAt', 'createdAt').addSelect('admission.updatedAt', 'updatedAt')
      .where('admission.id = :id', { id }).getRawOne<AdmissionRow>();
    if (!admission) throw new NotFoundException('Заявка на допуск не найдена.');
    await this.auditDetailRead('career_admission', access.actorId, admission.id, admission.studentId, admission.universityId, context);
    return admission;
  }

  async patchProfile(id: string, dto: PlatformCareerProfilePatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    const patch = this.pick(dto, ['headline', 'about', 'skills'] as const);
    if (!Object.keys(patch).length) throw new BadRequestException('Укажите поля профиля для исправления.');
    if (patch.headline !== undefined) patch.headline = String(patch.headline).trim();
    if (patch.about !== undefined) patch.about = String(patch.about).trim();
    if (patch.skills !== undefined) {
      const skills = (patch.skills as string[]).map(skill => skill.trim().normalize('NFKC')).filter(Boolean);
      if (skills.length > 20 || new Set(skills.map(skill => skill.toLocaleLowerCase('ru-RU'))).size !== skills.length) throw new BadRequestException('Направления должны быть непустыми и не повторяться.');
      patch.skills = skills;
    }
    if (patch.headline !== undefined && !patch.headline) throw new BadRequestException('Заголовок профиля не может быть пустым.');
    return this.db.transaction(async manager => {
      const profile = await manager.findOne(CareerProfile, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!profile) throw new NotFoundException('Карьерный профиль не найден.');
      await this.assertStudent(manager, profile.studentId, profile.universityId);
      const oldValues = this.snapshot(profile, Object.keys(patch));
      const changes = Object.fromEntries(Object.entries(patch).filter(([key, value]) => JSON.stringify((profile as unknown as Record<string, unknown>)[key]) !== JSON.stringify(value)));
      if (!Object.keys(changes).length) throw new BadRequestException('Новые значения совпадают с текущими.');
      Object.assign(profile, changes, { verification: 'pending' });
      const updated = await manager.save(CareerProfile, profile);
      await this.audit(manager, access.actorId, 'career_profile', id, { ...oldValues, ...this.snapshot(profile, ['verification']) }, { ...this.snapshot(updated, [...Object.keys(changes), 'verification']), adminReason: dto.reason.trim(), result: 'updated' }, updated.studentId, updated.universityId, context);
      return updated;
    });
  }

  async decideProfile(id: string, dto: PlatformCareerDecisionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const profile = await manager.findOne(CareerProfile, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!profile) throw new NotFoundException('Карьерный профиль не найден.');
      await this.assertStudent(manager, profile.studentId, profile.universityId);
      const verification = dto.decision === 'approved' ? 'verified' : 'rejected';
      if (profile.verification === verification) throw new ConflictException('Профиль уже имеет это решение.');
      const oldValues = this.snapshot(profile, ['verification']);
      profile.verification = verification;
      const updated = await manager.save(CareerProfile, profile);
      await this.audit(manager, access.actorId, 'career_profile', id, oldValues, { verification, decision: dto.decision, adminReason: dto.reason.trim(), result: 'updated' }, updated.studentId, updated.universityId, context);
      return updated;
    });
  }

  async patchAdmission(id: string, dto: PlatformCareerAdmissionPatchDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    const patch = this.pick(dto, ['skill', 'evidence'] as const);
    if (!Object.keys(patch).length) throw new BadRequestException('Укажите поля заявки для исправления.');
    if (patch.skill !== undefined) patch.skill = String(patch.skill).trim().toLocaleLowerCase('ru-RU');
    if (patch.evidence !== undefined) patch.evidence = String(patch.evidence).trim();
    if (patch.skill !== undefined && !patch.skill) throw new BadRequestException('Направление не может быть пустым.');
    if (patch.evidence !== undefined && !patch.evidence) throw new BadRequestException('Обоснование не может быть пустым.');
    return this.db.transaction(async manager => {
      const admission = await manager.findOne(CareerAdmission, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!admission) throw new NotFoundException('Заявка на допуск не найдена.');
      await this.assertStudent(manager, admission.studentId, admission.universityId);
      if (patch.skill !== undefined && patch.skill !== admission.skill && await manager.getRepository(CareerAdmission).existsBy({ studentId: admission.studentId, skill: String(patch.skill) })) throw new ConflictException('У студента уже есть заявка по этому направлению.');
      const oldValues = { ...this.snapshot(admission, Object.keys(patch)), ...this.snapshot(admission, ['state', 'basis', 'reason']) };
      const changes = Object.fromEntries(Object.entries(patch).filter(([key, value]) => (admission as unknown as Record<string, unknown>)[key] !== value));
      if (!Object.keys(changes).length) throw new BadRequestException('Новые значения совпадают с текущими.');
      Object.assign(admission, changes, { state: 'pending', basis: 'unspecified', reason: '' });
      const updated = await manager.save(CareerAdmission, admission);
      await this.audit(manager, access.actorId, 'career_admission', id, oldValues, { ...this.snapshot(updated, [...Object.keys(changes), 'state', 'basis', 'reason']), adminReason: dto.reason.trim(), result: 'updated' }, updated.studentId, updated.universityId, context);
      return updated;
    });
  }

  async decideAdmission(id: string, dto: PlatformCareerDecisionDto, context: RequestAuditContext = {}) {
    const access = await this.platform.require('career-data.write');
    this.assertReason(dto.reason);
    return this.db.transaction(async manager => {
      const admission = await manager.findOne(CareerAdmission, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!admission) throw new NotFoundException('Заявка на допуск не найдена.');
      await this.assertStudent(manager, admission.studentId, admission.universityId);
      const state = dto.decision;
      if (admission.state === state && admission.reason === dto.reason.trim()) throw new ConflictException('Заявка уже сохранена с таким решением и причиной.');
      const oldValues = this.snapshot(admission, ['state', 'basis', 'reason']);
      admission.state = state;
      admission.basis = state === 'approved' ? 'center' : 'unspecified';
      admission.reason = dto.reason.trim();
      const updated = await manager.save(CareerAdmission, admission);
      await this.audit(manager, access.actorId, 'career_admission', id, oldValues, { state, basis: updated.basis, reason: updated.reason, adminReason: dto.reason.trim(), result: 'updated' }, updated.studentId, updated.universityId, context);
      return updated;
    });
  }

  private async assertStudent(manager: EntityManager, studentId: string, universityId: string): Promise<void> {
    const user = await manager.findOne(User, { where: { id: studentId }, select: ['id'] });
    if (!user || !await manager.getRepository(University).existsBy({ id: universityId })) throw new BadRequestException('Карьерная запись не связана с существующим пользователем и университетом.');
  }

  private applySearch<T extends CareerProfile | CareerAdmission>(qb: SelectQueryBuilder<T>, query: string, fields: string[]): void {
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    qb.andWhere(`(${fields.map(field => `${field} ILIKE :q ESCAPE E'\\\\'`).join(' OR ')})`, { q: pattern });
  }

  private async paginate<T extends CareerProfile | CareerAdmission, R>(qb: SelectQueryBuilder<T>, page: number, limit: number, orderField: string, idField: string): Promise<[R[], number]> {
    const total = await qb.clone().getCount();
    const data = await qb.orderBy(orderField, 'DESC').addOrderBy(idField, 'DESC').skip((page - 1) * limit).take(limit).getRawMany<R>();
    return [data, total];
  }

  private pick<T extends string>(source: object, fields: readonly T[]): Partial<Record<T, unknown>> {
    const values = source as Record<string, unknown>;
    return Object.fromEntries(fields.filter(field => values[field] !== undefined).map(field => [field, values[field]])) as Partial<Record<T, unknown>>;
  }

  private snapshot<T extends object>(record: T, fields: readonly string[]): JsonObject {
    const source = record as Record<string, unknown>;
    return Object.fromEntries(fields.map(field => [field, source[field] ?? null])) as JsonObject;
  }

  private assertReason(reason: string): void {
    if (reason.trim().length < 3) throw new BadRequestException('Укажите причину изменения (не менее 3 символов).');
  }

  private async auditRead<T extends { id: string; universityId: string }>(entity: string, actorId: string, rows: T[], query: PlatformCareerProfileQueryDto | PlatformCareerAdmissionQueryDto, total: number, context: RequestAuditContext): Promise<void> {
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({
      userId: actorId,
      action: `platform.${entity}.search`,
      entity: `personal_data.${entity}`,
      entityId: 'search',
      newValues: {
        recordIds: rows.map(row => row.id),
        universityIds: [...new Set(rows.map(row => row.universityId))],
        ...(query.universityId ? { universityId: query.universityId } : {}),
        page: query.page,
        limit: query.limit,
        resultCount: rows.length,
        total,
      },
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private async auditDetailRead(entity: string, actorId: string, id: string, targetUserId: string, universityId: string, context: RequestAuditContext): Promise<void> {
    await this.db.getRepository(AuditLog).save(this.db.getRepository(AuditLog).create({
      userId: actorId,
      action: `platform.${entity}.viewed`,
      entity: `personal_data.${entity}`,
      entityId: id,
      newValues: { targetUserId, universityId, result: 'viewed' },
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }

  private async audit(manager: EntityManager, actorId: string, entity: string, id: string, oldValues: JsonObject, newValues: JsonObject, targetUserId: string, universityId: string, context: RequestAuditContext): Promise<void> {
    await manager.save(AuditLog, manager.create(AuditLog, {
      userId: actorId,
      action: `platform.${entity}.${newValues.result === 'created' ? 'created' : newValues.result === 'deleted' ? 'deleted' : 'updated'}`,
      entity: `personal_data.${entity}`,
      entityId: id,
      oldValues,
      newValues: { ...newValues, targetUserId, universityId },
      ...(context.ip ? { ip: context.ip } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 512) } : {}),
    }));
  }
}
