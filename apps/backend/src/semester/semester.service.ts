import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRole } from '../auth/interfaces/user-role';
import { TenantContext } from '../common/tenant/tenant-context';
import { requireUniversityId } from '../common/tenant/require-university';
import { toPaginatedResponse } from '../common/dto/pagination-query.dto';
import { AuditLog } from '../common/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { University } from '../users/entities/university.entity';
import { MoodleConnectionConfig, MoodleConnectorService, normalizeMoodleBaseUrl } from '../moodle/moodle-connector.service';
import { AcademicIdentity } from './academic-identity.entity';
import { MoodleIdentityDto, SemesterQueryDto } from './semester.dto';
import { semesterGrade, semesterPeriods, sourceFlag } from './semester-source';

@Injectable()
export class SemesterService {
  constructor(private readonly db: DataSource, private readonly tenant: TenantContext, private readonly moodle: MoodleConnectorService) {}
  private actor(role: UserRole) {
    const actor = this.tenant.getUser();
    if (!actor || actor.role !== role) throw new ForbiddenException('Это действие недоступно вашей роли.');
    return { ...actor, universityId: requireUniversityId(actor) };
  }
  private connection(university: University): MoodleConnectionConfig | null {
    if (university.connectorType !== 'moodle') return null;
    const config = university.connectorConfig;
    if (!config || config.status === 'inactive' || !['baseUrl', 'encryptedToken', 'tokenIv', 'tokenTag'].every(key => typeof config[key] === 'string' && config[key])) return null;
    const baseUrl = normalizeMoodleBaseUrl(config.baseUrl as string);
    if (baseUrl.length > 1024) throw new BadRequestException('Слишком длинный адрес источника Moodle.');
    return { baseUrl, encryptedToken: config.encryptedToken as string, tokenIv: config.tokenIv as string, tokenTag: config.tokenTag as string };
  }
  private async university(id: string, manager = this.db.manager) {
    const university = await manager.findOneBy(University, { id });
    if (!university) throw new NotFoundException('Вуз недоступен.');
    return university;
  }
  private async student(id: string, universityId: string, manager = this.db.manager) {
    if (!await manager.existsBy(User, { id, universityId, role: UserRole.STUDENT, isActive: true })) throw new NotFoundException('Студент своего вуза не найден.');
  }
  async identity(studentId: string) {
    const actor = this.actor(UserRole.UNIVERSITY_ADMIN);
    await this.student(studentId, actor.universityId);
    return this.db.manager.findOneBy(AcademicIdentity, { universityId: actor.universityId, userId: studentId });
  }
  async link(studentId: string, dto: MoodleIdentityDto) {
    const actor = this.actor(UserRole.UNIVERSITY_ADMIN);
    if (!dto.confirmed || dto.reason.trim().length < 3) throw new BadRequestException('Подтвердите личность в источнике и укажите основание.');
    try {
      return await this.db.transaction(async manager => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`semester:${actor.universityId}`]);
        await this.student(studentId, actor.universityId, manager);
        const connection = this.connection(await this.university(actor.universityId, manager));
        if (!connection) throw new BadRequestException('Сначала настройте Moodle своего вуза.');
        const old = await manager.findOneBy(AcademicIdentity, { universityId: actor.universityId, userId: studentId });
        const identity = await manager.save(AcademicIdentity, manager.create(AcademicIdentity, { ...(old ? { id: old.id } : {}), universityId: actor.universityId, userId: studentId, sourceBaseUrl: connection.baseUrl, externalUserId: dto.externalUserId, linkedBy: actor.id }));
        await manager.save(AuditLog, manager.create(AuditLog, { userId: actor.id, action: 'academic.identity.linked', entity: 'academic_identity', entityId: identity.id, newValues: { universityId: actor.universityId, studentId, provider: 'moodle', reason: dto.reason.trim() } }));
        return identity;
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Этот ID Moodle уже связан с другим студентом своего вуза.');
      throw error;
    }
  }
  async unlink(studentId: string) {
    const actor = this.actor(UserRole.UNIVERSITY_ADMIN);
    return this.db.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`semester:${actor.universityId}`]);
      await this.student(studentId, actor.universityId, manager);
      const identity = await manager.findOneBy(AcademicIdentity, { universityId: actor.universityId, userId: studentId });
      if (identity) {
        await manager.delete(AcademicIdentity, identity.id);
        await manager.save(AuditLog, manager.create(AuditLog, { userId: actor.id, action: 'academic.identity.unlinked', entity: 'academic_identity', entityId: identity.id, newValues: { universityId: actor.universityId, studentId, provider: 'moodle' } }));
      }
      return { unlinked: true };
    });
  }
  async periods() {
    const actor = this.actor(UserRole.STUDENT), university = await this.university(actor.universityId);
    const connection = this.connection(university);
    return { available: !!connection, source: connection ? { provider: 'moodle', baseUrl: connection.baseUrl } : null, periods: connection ? semesterPeriods(university.connectorConfig?.semesterPeriods).map(({ id, label }) => ({ id, label })) : [] };
  }
  async overview(query: SemesterQueryDto) {
    const actor = this.actor(UserRole.STUDENT), university = await this.university(actor.universityId);
    const connection = this.connection(university);
    const debtSource = { available: false, source: null, records: [], message: 'Стандартный отчёт Moodle не является реестром академических задолженностей. Подтверждённый реестр не подключён.' };
    const unavailable = (reason: string, message: string) => ({ ...toPaginatedResponse([], 0, query), available: false, source: null, period: query.period, reason, message, debtSource });
    if (!connection) return unavailable('source_unavailable', 'Вуз не подключил действующий источник оценок Moodle.');
    const period = semesterPeriods(university.connectorConfig?.semesterPeriods).find(row => row.id === query.period);
    if (!period) return unavailable('period_unconfigured', 'Вуз не настроил курсы этого семестра.');
    const identity = await this.db.manager.findOneBy(AcademicIdentity, { universityId: actor.universityId, userId: actor.id, sourceBaseUrl: connection.baseUrl });
    if (!identity) return unavailable('identity_unlinked', 'Администратор ещё не связал ваш аккаунт с проверенным числовым ID Moodle этого источника.');
    try {
      const courses = await this.moodle.getUserCourses(connection, Number(identity.externalUserId));
      const seen = new Set<number>();
      const applicable = courses.filter(course => {
        if (!Number.isSafeInteger(course.id) || Number(course.id) < 1 || seen.has(Number(course.id))) throw new BadGatewayException('Moodle вернул неоднозначный список курсов.');
        seen.add(Number(course.id));
        return period.courseIds.includes(Number(course.id)) && sourceFlag(course.visible);
      }).sort((a, b) => period.courseIds.indexOf(Number(a.id)) - period.courseIds.indexOf(Number(b.id)));
      const page = applicable.slice((query.page - 1) * query.limit, query.page * query.limit);
      const data: Array<{ id: number; name: string; available: boolean; grades: ReturnType<typeof semesterGrade>[] }> = [];
      for (let start = 0; start < page.length; start += 4) {
        const batch = await Promise.all(page.slice(start, start + 4).map(async course => ({
          id: Number(course.id), name: typeof course.fullname === 'string' ? course.fullname.replace(/<[^>]*>/g, '').slice(0, 500) : '',
          available: sourceFlag(course.showgrades),
          grades: !sourceFlag(course.showgrades) ? [] : (await this.moodle.getUserGradeItems(connection, Number(identity.externalUserId), Number(course.id))).map(semesterGrade),
        })));
        data.push(...batch);
      }
      return { ...toPaginatedResponse(data, applicable.length, query), available: true, source: { provider: 'moodle', baseUrl: connection.baseUrl, fetchedAt: new Date().toISOString() }, period: { id: period.id, label: period.label }, gradeScope: 'current_course_state', debtSource };
    } catch {
      throw new BadGatewayException('Не удалось получить полный отчёт Moodle. Проверьте доступность источника и права сервисного пользователя; повторите запрос.');
    }
  }
}
