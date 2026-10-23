import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { TenantContext } from '../common/tenant/tenant-context';
import { PlatformService } from '../platform/platform.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UserRole } from '../auth/interfaces/user-role';

/** Describes actual local effects; it never promises removal from another operator or a backup. */
export const ACCOUNT_RETENTION = [
  'Учебные записи, заявления, работы и результаты остаются в архиве вуза под внутренним кодом. Группа, даты и тексты могут позволить узнать человека: это не полное обезличивание.',
  'Платёжная история компании сохраняется отдельно, включая ранее указанный email для чека. Удаление аккаунта не отменяет платежи и не удаляет документы банка.',
  'Реквизиты компании и полученные из реестра ИНН, имя и ОГРН/ОГРНИП сохраняются отдельно. Для ИП эти сведения могут позволить установить человека; для их исправления и удаления нужен запрос оператору.',
  'История рассмотрения жалоб по карьерным задачам сохраняется под внутренними кодами. Текст собственной жалобы очищается; решения сотрудников остаются частью истории и могут требовать отдельной проверки оператором.',
  'Журналы других участников и общий учебный контент могут содержать прежние упоминания имени. Для их проверки нужен запрос оператору.',
  'Файлы по внешним URL, Moodle, источники расписания, сообщения внешних сервисов, серверные логи и резервные копии требуют отдельной процедуры. Имя преподавателя из вузовского источника может сохраниться независимо от аккаунта.',
] as const;

const PRIVATE_ROWS: Record<string, string> = {
  academic_identities: 'userId', personal_lesson_notes: 'userId', user_favorites: 'userId',
  notifications: 'userId', notification_deliveries: 'userId', notification_preferences: 'userId', inbox_items: 'userId',
  device_tokens: 'userId', telegram_link_challenges: 'userId', career_profile: 'studentId', career_availability: 'studentId',
  career_portfolio: 'studentId', career_notice: 'userId', career_ai_request: 'userId', platform_grants: 'userId',
};
const LINKED_ROWS: Record<string, string> = {
  career_membership: 'userId', career_admission: 'studentId', career_task_complaint: 'studentId', curator_assignments: 'userId', office_assignments: 'userId', groups: 'curatorId', faculties: 'deanUserId', attendance_qr_sessions: 'createdById',
};
type Blocker = { code: string; message: string };

@Injectable()
export class AccountErasureService {
  constructor(private readonly db: DataSource, private readonly tenant: TenantContext, private readonly platform: PlatformService) {}

  private actor() {
    const actor = this.tenant.getUser();
    if (!actor) throw new ForbiddenException();
    return actor;
  }

  private async blockers(runner: QueryRunner, locking: boolean): Promise<Blocker[]> {
    const actor = this.actor(), result: Blocker[] = [];
    const control = await runner.query(`SELECT "ownerId" FROM platform_control WHERE id='platform'${locking ? ' FOR SHARE' : ''}`);
    if (control[0]?.ownerId === actor.id) result.push({ code: 'platform_owner', message: 'Сначала передайте владение платформой другому действующему аккаунту.' });
    // A company owner cannot strand the company by deleting its only accountable representative.
    const companies = await runner.query(`SELECT DISTINCT "companyId" AS id FROM career_membership WHERE "userId"=$1 AND role='company_owner' AND "revokedAt" IS NULL AND "companyId" IS NOT NULL`, [actor.id]);
    for (const company of companies) {
      if (locking) await runner.query('SELECT id FROM career_company WHERE id=$1 FOR UPDATE', [company.id]);
      const owners = await this.tenant.runWithDatabaseAccess({ relation: { table: 'career_membership', column: 'companyId', value: company.id } },
        () => runner.query('SELECT "userId" FROM career_membership WHERE "companyId"=$1 AND role=\'company_owner\' AND "revokedAt" IS NULL AND "userId"<>$2', [company.id, actor.id]));
      let anotherActiveOwner = false;
      for (const owner of owners) {
        const users = await this.tenant.runWithDatabaseAccess({ authentication: { id: owner.userId } }, () => runner.query('SELECT id FROM users WHERE id=$1 AND "isActive"=true', [owner.userId]));
        if (users.length) anotherActiveOwner = true;
      }
      if (!anotherActiveOwner) result.push({ code: 'company_owner', message: 'Вы единственный владелец компании. Сначала передайте управление через оператора платформы.' });
    }
    const routes = await runner.query('SELECT id FROM office_routes WHERE $1::uuid=ANY("assigneeIds") LIMIT 1', [actor.id]);
    if (routes.length) result.push({ code: 'office_route', message: 'Администратор вуза должен заменить вас в маршрутах согласования заявлений.' });
    const steps = await runner.query(`SELECT s.id FROM request_steps s JOIN student_requests r ON r.id=s."requestId"
      WHERE s."assigneeId"=$1 AND s.state='pending' AND r.status IN ('submitted','in_review','needs_changes') LIMIT 1`, [actor.id]);
    if (steps.length) result.push({ code: 'pending_approval', message: 'Передайте незавершённые согласования: администратор может переназначить этапы.' });
    if (actor.role === UserRole.UNIVERSITY_ADMIN && actor.universityId) {
      const [others] = await runner.query('SELECT count(*)::int AS count FROM users WHERE "universityId"=$1 AND role=$2 AND "isActive"=true AND id<>$3', [actor.universityId, UserRole.UNIVERSITY_ADMIN, actor.id]);
      if (!others.count) result.push({ code: 'university_admin', message: 'Сначала назначьте другого администратора вуза через владельца платформы.' });
    }
    return result;
  }

  async preview() {
    const actor = this.actor();
    return this.tenant.runWithDatabaseAccess({ personalData: { userId: actor.id } }, async () => {
      const runner = this.db.createQueryRunner();
      try {
        await runner.connect();
        return { accountId: actor.id, archiveModel: 'pseudonymous', retained: ACCOUNT_RETENTION, blockers: await this.blockers(runner, false),
          removed: ['ФИО и контакты профиля, пароль и вход во всех сессиях', 'MAX/Telegram/Moodle-привязки, push-токены и настройки доставки', 'Личные заметки, избранное, уведомления, карьерный профиль и опубликованное портфолио', 'Действующие личные назначения и права платформы'],
          downloadBeforeDeletion: '/api/v1/users/me/export' };
      } finally { await runner.release(); }
    });
  }

  async erase(dto: DeleteAccountDto) {
    const actor = this.actor();
    if (dto.expectedUserId !== actor.id) throw new ConflictException('Аккаунт изменился. Заново откройте экран подтверждения.');
    if (dto.confirmed !== true || dto.acknowledgeRetention !== true) throw new ConflictException('Подтвердите удаление и сохранение перечисленных архивных данных.');
    // Preserve existing protection for platform identities, without leaking delegated grants into self-erasure.
    await this.tenant.runInRequest(async () => { this.tenant.setUser(actor); await this.platform.protectLegacyMutation(actor.id); });
    const destroyedPassword = await bcrypt.hash(randomBytes(48).toString('hex'), 12);
    return this.tenant.runWithDatabaseAccess({ personalData: { userId: actor.id } }, async () => {
      const runner = this.db.createQueryRunner();
      try {
        await runner.connect(); await runner.startTransaction();
        // Shared with existing owner/grant changes; acquire it before any user row lock.
        await runner.query('SELECT pg_advisory_xact_lock(707247126)');
        // Same lock/order as office assignment, route and decision mutations: no new stage can target this account after the check.
        if (actor.universityId) await runner.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`office:${actor.universityId}`]);
        const [user] = await runner.query('SELECT id, "passwordHash", "isActive", "personalDataDeletedAt",role,"universityId","sessionVersion" FROM users WHERE id=$1 FOR UPDATE', [actor.id]);
        if (!user?.isActive || user.personalDataDeletedAt) throw new UnauthorizedException();
        if (actor.sessionVersion !== undefined && user.sessionVersion !== actor.sessionVersion) throw new UnauthorizedException('Сессия отозвана. Войдите заново.');
        if (user.role !== actor.role || user.universityId !== actor.universityId) throw new ConflictException('Учётная запись изменилась. Заново откройте экран подтверждения.');
        if (typeof dto.currentPassword !== 'string' || !await bcrypt.compare(dto.currentPassword, user.passwordHash)) throw new UnauthorizedException('Пароль не подтверждён');
        const blocked = await this.blockers(runner, true);
        if (blocked.length) throw new ConflictException({ message: 'Сначала передайте действующие обязанности.', blockers: blocked });
        const rows: Record<string, string[]> = { users: [actor.id] };
        for (const [table, column] of Object.entries({ ...PRIVATE_ROWS, ...LINKED_ROWS })) {
          const key = table === 'career_availability' ? 'studentId' : table === 'platform_grants' ? 'userId' : 'id';
          rows[table] = (await runner.query(`SELECT "${key}"::text AS id FROM "${table}" WHERE "${column}"=$1`, [actor.id])).map(row => row.id);
        }
        rows.event_records = (await runner.query('SELECT id::text FROM event_records WHERE actor->>\'id\'=$1', [actor.id])).map(row => row.id);
        const counts: Record<string, number> = {};
        await this.tenant.runWithDatabaseAccess({ personalErasure: { userId: actor.id, rows } }, async () => {
          for (const [table, column] of Object.entries(PRIVATE_ROWS)) {
            await runner.query(`DELETE FROM "${table}" WHERE "${column}"=$1`, [actor.id]);
            counts[table] = rows[table].length;
          }
          for (const table of ['curator_assignments', 'office_assignments', 'career_membership']) {
            await runner.query(`UPDATE "${table}" SET "revokedAt"=COALESCE("revokedAt",CURRENT_TIMESTAMP), "revokedBy"=$1 WHERE "userId"=$1`, [actor.id]);
          }
          await runner.query('UPDATE groups SET "curatorId"=NULL WHERE "curatorId"=$1', [actor.id]);
          await runner.query('UPDATE faculties SET "deanUserId"=NULL WHERE "deanUserId"=$1', [actor.id]);
          await runner.query('UPDATE attendance_qr_sessions SET "revokedAt"=COALESCE("revokedAt",CURRENT_TIMESTAMP) WHERE "createdById"=$1', [actor.id]);
          await runner.query('UPDATE career_application SET message=\'\' WHERE "studentId"=$1', [actor.id]);
          await runner.query('UPDATE career_task_complaint SET details=\'[Текст жалобы удалён пользователем]\' WHERE "studentId"=$1', [actor.id]);
          await runner.query('UPDATE career_admission SET evidence=\'\',reason=\'\' WHERE "studentId"=$1', [actor.id]);
          await runner.query('UPDATE discussion_messages SET text=\'[Сообщение удалено]\',"moderationReason"=NULL WHERE "userId"=$1', [actor.id]);
          await runner.query('UPDATE file_attachments SET "fileUrl"=\'\',"fileName"=\'Удалённый файл\',"revokedAt"=COALESCE("revokedAt",CURRENT_TIMESTAMP),"revokedBy"=$1,"revokeReason"=\'Аккаунт удалён\' WHERE "uploadedBy"=$1', [actor.id]);
          // Scrub the self-authored technical audit payload; other actors' logs are an explicit retained exception.
          await runner.query('UPDATE audit_logs SET "oldValues"=NULL,"newValues"=NULL,ip=NULL,"userAgent"=NULL WHERE "userId"=$1', [actor.id]);
          await runner.query('UPDATE event_records SET actor=jsonb_build_object(\'type\',\'user\',\'id\',$1::text),payload=\'{"redacted":true}\'::jsonb WHERE actor->>\'id\'=$1', [actor.id]);
          await runner.query(`UPDATE users SET email=$2,"firstName"='Архив',"lastName"=$3,phone=NULL,"avatarUrl"=NULL,"passwordHash"=$4,
            "maxUserId"=NULL,"telegramUserId"=NULL,"sourceTeacherId"=NULL,"isActive"=false,"sessionVersion"="sessionVersion"+1,
            "lastLoginAt"=NULL,"personalDataDeletedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`,
          [actor.id, `deleted-${randomBytes(24).toString('hex')}@account.invalid`, actor.id.slice(0, 8), destroyedPassword]);
        });
        const [receipt] = await runner.query('SELECT "personalDataDeletedAt" AS "deletedAt" FROM users WHERE id=$1', [actor.id]);
        await runner.commitTransaction();
        return { success: true, archiveCode: actor.id, deletedAt: receipt.deletedAt, archiveModel: 'pseudonymous', removedCounts: counts, retained: ACCOUNT_RETENTION };
      } catch (error) {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        throw error;
      } finally { await runner.release(); }
    });
  }
}
