import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { AuditLog } from '../common/entities/audit-log.entity';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { Group } from '../users/entities/group.entity';
import { User } from '../users/entities/user.entity';
import { OfficeAccessService } from './office-access.service';
import { OfficeDebtImportDto, OfficeReportQueryDto } from './office-report.dto';
import { OfficeDebtRecord, OfficeDebtSnapshot } from './office-report.entities';

@Injectable()
export class OfficeReportService {
  constructor(private readonly db: DataSource, private readonly access: OfficeAccessService) {}

  /** UUID and legacy external group keys must identify exactly one own-university group. */
  private matches(groups: Group[], key: string | null) {
    return key ? groups.filter(group => group.id === key || group.externalId === key) : [];
  }
  private async allowed(manager: EntityManager, query: OfficeReportQueryDto) {
    const actor = this.access.actor(), scope = await this.access.scope(manager);
    const permitted = new Set([...scope.office, ...scope.dean]);
    if (actor.role !== UserRole.UNIVERSITY_ADMIN && !permitted.size) throw new ForbiddenException('Нужно назначение учебного офиса или декана.');
    const groups = scope.groups.filter(group => actor.role === UserRole.UNIVERSITY_ADMIN || permitted.has(group.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id));
    if (query.groupId && !groups.some(group => group.id === query.groupId)) throw new NotFoundException('Группа недоступна.');
    if (query.facultyId && !groups.some(group => group.facultyId === query.facultyId)) throw new NotFoundException('Факультет недоступен.');
    return { allGroups: scope.groups, groups: groups.filter(group => (!query.groupId || group.id === query.groupId) && (!query.facultyId || group.facultyId === query.facultyId)) };
  }
  private async activeStudents(manager: EntityManager, groupKeys: string[]) {
    return manager.find(User, { where: { universityId: this.access.actor().universityId, role: UserRole.STUDENT, isActive: true, groupId: In(groupKeys) }, select: ['id', 'groupId'] });
  }
  private async snapshots(manager: EntityManager, groups: Group[]): Promise<OfficeDebtSnapshot[]> {
    return groups.length ? manager.findBy(OfficeDebtSnapshot, { universityId: this.access.actor().universityId, groupId: In(groups.map(group => group.id)), supersededAt: IsNull() }) : [];
  }
  async contingent(query: OfficeReportQueryDto) {
    return this.db.transaction('REPEATABLE READ', async manager => {
      const actor = this.access.actor(), { allGroups, groups } = await this.allowed(manager, query);
      const students = await manager.getRepository(User).createQueryBuilder('u').select('u.groupId', 'groupId').addSelect('COUNT(*)::int', 'total')
        .where('u.universityId = :uni AND u.role = :role AND u.isActive = true', { uni: actor.universityId, role: UserRole.STUDENT })
        .groupBy('u.groupId').getRawMany<{ groupId: string | null; total: number }>();
      const sources = await this.snapshots(manager, groups);
      const counts = new Map(groups.map(group => [group.id, 0]));
      let unresolved = 0;
      for (const student of students) {
        const matches = this.matches(allGroups, student.groupId);
        if (matches.length !== 1) { unresolved += student.total; continue; }
        if (counts.has(matches[0].id)) counts.set(matches[0].id, counts.get(matches[0].id)! + student.total);
      }
      const rows = groups.map(group => ({ groupId: group.id, groupName: group.name, facultyId: group.facultyId,
        activeStudents: counts.get(group.id)!, debtSource: this.sourceInfo(sources.find(source => source.groupId === group.id)) }));
      return { universityId: actor.universityId, generatedAt: new Date().toISOString(), basis: 'current_active_platform_student_accounts',
        totalActiveStudents: rows.reduce((sum, row) => sum + row.activeStudents, 0),
        unresolvedStudentGroups: actor.role === UserRole.UNIVERSITY_ADMIN && !query.groupId && !query.facultyId ? unresolved : null,
        ...toPaginatedResponse(rows.slice((query.page - 1) * query.limit, query.page * query.limit), rows.length, query),
        limitations: ['Считаются текущие активные студенческие аккаунты платформы; это не официальный контингент по приказам.', 'Неоднозначные и отсутствующие группы не распределяются предположительно.'] };
    });
  }
  private sourceInfo(source?: OfficeDebtSnapshot) {
    return source ? { available: true, snapshotId: source.id, source: source.source, reference: source.reference,
      asOfDate: source.asOfDate, confirmedAt: source.createdAt, confirmation: 'university_admin_attestation' }
      : { available: false, source: null, message: 'Нет подтверждённого полного реестра задолженностей этой группы.' };
  }
  async sourceStatus(groups: Group[]) {
    const sources = await this.snapshots(this.db.manager, groups);
    return { available: sources.length > 0, source: sources.length ? 'office_confirmed_registry' : null,
      message: sources.length ? `Подтверждённый реестр есть у ${sources.length} из ${groups.length} доступных групп. Даты и полнота показаны в отчётах.` : 'Вуз не подключил подтверждённый источник оценок и академических задолженностей.' };
  }
  async debts(query: OfficeReportQueryDto) {
    return this.db.transaction('REPEATABLE READ', async manager => {
      const { groups } = await this.allowed(manager, query), sources = await this.snapshots(manager, groups);
      // Keep pagination/counting in SQL; never fetch a university's complete individual register.
      const [rows, total] = sources.length ? await manager.getRepository(OfficeDebtRecord).createQueryBuilder('debt')
        .innerJoin(User, 'student', 'student.id = debt.studentId AND student.universityId = debt.universityId AND student.isActive = true AND student.role = :role', { role: UserRole.STUDENT })
        .innerJoin(Group, 'g', 'g.id = debt.groupId AND g.universityId = debt.universityId AND (student.groupId = g.id::text OR student.groupId = g.externalId)')
        .where('debt.universityId = :uni AND debt.snapshotId IN (:...sources)', { uni: this.access.actor().universityId, sources: sources.map(source => source.id) })
        .andWhere('NOT EXISTS (SELECT 1 FROM groups ambiguous WHERE ambiguous."universityId" = debt."universityId" AND ambiguous.id <> g.id AND (student."groupId" = ambiguous.id::text OR student."groupId" = ambiguous."externalId"))')
        .orderBy('debt.groupId', 'ASC').addOrderBy('debt.studentId', 'ASC').addOrderBy('debt.subject', 'ASC').addOrderBy('debt.id', 'ASC')
        .skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount() : [[], 0] as [OfficeDebtRecord[], number];
      return { generatedAt: new Date().toISOString(), sourceCoverage: groups.map(group => ({ groupId: group.id, ...this.sourceInfo(sources.find(source => source.groupId === group.id)) })),
        ...toPaginatedResponse(rows.map(({ id, groupId, studentId, subject, period, basis, snapshotId }) => ({ id, groupId, studentId, subject, period, basis, snapshotId })), total, query),
        limitations: ['Подтверждение администратора не является независимой проверкой подлинности источника.', 'Нулевая выборка без полного подтверждённого источника не означает отсутствие задолженностей.', 'Учёт только актуального снимка и текущих активных студентов той же группы; это не история движения контингента.'] };
    });
  }
  async studentDebts(studentId: string) {
    return this.db.transaction('REPEATABLE READ', async manager => {
      const actor = this.access.actor(), student = await manager.findOneBy(User, { id: studentId, universityId: actor.universityId, role: UserRole.STUDENT, isActive: true });
      if (!student) throw new NotFoundException('Студент недоступен.');
      const groups = await manager.findBy(Group, { universityId: actor.universityId }), matches = this.matches(groups, student.groupId);
      if (matches.length !== 1) throw new BadRequestException('Нужна однозначная привязка к учебной группе.');
      const group = matches[0];
      if (studentId !== actor.id && actor.role !== UserRole.UNIVERSITY_ADMIN && !await this.access.hasDuty(manager, group, 'office') && !await this.access.canPerform(manager, group, 'curator_or_dean', actor.id)) throw new ForbiddenException('Нет доступа к этому студенту.');
      const source = (await this.snapshots(manager, [group]))[0];
      const records = source ? await manager.find(OfficeDebtRecord, { where: { universityId: actor.universityId, snapshotId: source.id, studentId }, select: ['id', 'subject', 'period', 'basis'], order: { subject: 'ASC', id: 'ASC' } }) : [];
      return { studentId, ...this.sourceInfo(source), records, message: source ? 'Полный реестр группы подтверждён администратором на указанную дату; более поздние изменения не проверены.' : 'Вуз не подключил подтверждённый источник оценок и академических задолженностей.' };
    });
  }
  async importDebts(dto: OfficeDebtImportDto) {
    const actor = this.access.admin();
    if (!dto.confirmsOfficialSource || !dto.confirmsCompleteGroupSnapshot) throw new BadRequestException('Нужно подтвердить официальный источник и полноту реестра группы.');
    if (dto.source.trim().length < 3) throw new BadRequestException('Укажите название официального источника.');
    if (dto.asOfDate < '1900-01-01' || dto.asOfDate > new Date().toISOString().slice(0, 10) || new Date(dto.asOfDate).toISOString().slice(0, 10) !== dto.asOfDate) throw new BadRequestException('Нужна существующая дата источника, не позднее текущей даты UTC.');
    const records = dto.records.map(row => ({ studentId: row.studentId, subject: row.subject.trim(), period: row.period.trim(), basis: row.basis.trim() }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const digest = createHash('sha256').update(JSON.stringify({ groupId: dto.groupId, source: dto.source.trim(), reference: dto.reference.trim(), asOfDate: dto.asOfDate, records })).digest('hex');
    if (new Set(records.map(row => JSON.stringify([row.studentId, row.subject, row.period]))).size !== records.length) throw new BadRequestException('Дубли студента, дисциплины и периода в реестре.');
    return this.db.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`office-debts:${actor.universityId}`]);
      const validatedGroup = await this.access.group(manager, dto.groupId);
      const previous = await manager.findOneBy(OfficeDebtSnapshot, { universityId: actor.universityId, requestId: dto.requestId });
      if (previous) {
        if (previous.digest !== digest) throw new ConflictException('Этот идентификатор импорта уже использован с другими данными.');
        return { id: previous.id, count: await manager.countBy(OfficeDebtRecord, { universityId: actor.universityId, snapshotId: previous.id }), replay: true };
      }
      const groups = await manager.findBy(Group, { universityId: actor.universityId });
      const group = validatedGroup;
      const keys = [...new Set([group.id, ...(group.externalId ? [group.externalId] : [])])].filter(key => this.matches(groups, key).length === 1);
      const students = await this.activeStudents(manager, keys);
      const allowed = new Set(students.filter(student => { const matches = this.matches(groups, student.groupId); return matches.length === 1 && matches[0].id === dto.groupId; }).map(student => student.id));
      if (records.some(row => !allowed.has(row.studentId))) throw new BadRequestException('Все записи должны принадлежать действующим студентам выбранной группы своего вуза.');
      const current = await manager.findOneBy(OfficeDebtSnapshot, { universityId: actor.universityId, groupId: dto.groupId, supersededAt: IsNull() });
      if (current && current.asOfDate > dto.asOfDate) throw new ConflictException('Нельзя заменить текущий реестр более старой датой.');
      if (current) await manager.update(OfficeDebtSnapshot, { id: current.id, universityId: actor.universityId }, { supersededAt: new Date() });
      const snapshot = await manager.save(OfficeDebtSnapshot, manager.create(OfficeDebtSnapshot, {
        universityId: actor.universityId, groupId: dto.groupId, requestId: dto.requestId, digest,
        source: dto.source.trim(), reference: dto.reference.trim(), asOfDate: dto.asOfDate, verifiedBy: actor.id,
      }));
      if (records.length) await manager.insert(OfficeDebtRecord, records.map(row => ({ ...row, universityId: actor.universityId, groupId: dto.groupId, snapshotId: snapshot.id })));
      await manager.save(AuditLog, manager.create(AuditLog, { userId: actor.id, action: 'office.debt-source.confirmed', entity: 'academic-office', entityId: snapshot.id, newValues: { universityId: actor.universityId, groupId: dto.groupId, count: records.length, asOfDate: dto.asOfDate } }));
      return { id: snapshot.id, count: records.length, replay: false };
    });
  }
}
