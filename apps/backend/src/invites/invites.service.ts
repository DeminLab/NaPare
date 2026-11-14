import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

import { TenantContext } from '../common/tenant/tenant-context';
import { requireOrganizationId } from '../common/tenant/require-university';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuthResponse } from '../auth/interfaces/auth-response.interface';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../auth/interfaces/user-role';
import { User } from '../users/entities/user.entity';
import { UserRoleMembership } from '../users/entities/user-role.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TelemetryRequestContext } from '../telemetry/telemetry.service';
import { Invite } from './entities/invite.entity';
import { LinkRequest, LinkRequestStatus } from './entities/link-request.entity';
import { CreateInviteDto } from './dto/create-invite.dto';
import { ClaimInviteDto } from './dto/claim-invite.dto';
import { CreateLinkRequestDto } from './dto/create-link-request.dto';
import { DecideLinkRequestDto } from './dto/decide-link-request.dto';
import {
  INVITE_MAX_ATTEMPTS,
  INVITE_TTL_DAYS,
  INVITE_UNIFORM_MESSAGE,
} from './invites.constants';

export interface PublicInvitePayload {
  organizationName: string | null;
  groupName: string | null;
  factorType: string;
  expiresAt: Date;
}

export interface AdminInviteView {
  id: string;
  studentEmail: string | null;
  studentId: string | null;
  groupId: string | null;
  expectedFullName: string;
  factorType: string;
  expiresAt: Date;
  claimedAt: Date | null;
  claimedUserId: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const normalizeFullName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase().replace(/ё/g, 'е');

/**
 * TZ 9.2 onboarding: public invite lookup/claim, the FR-ONB-04 linkage
 * request queue and the FR-STF-04 staff management surface.
 *
 * Security model (SEC-09): the shareable token exists only in the creation
 * response; the row stores its sha256 and is reachable publicly through a
 * relation capability scoped to that hash. Unknown, consumed and
 * wrong-data/wrong-factor claims answer with one uniform 404; the per-invite
 * attempt limit answers 429 `LINK_ATTEMPTS_EXCEEDED` and notifies the
 * organization's staff admins about the suspicious activity.
 */
@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly db: DataSource,
    private readonly tenant: TenantContext,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- staff: invites

  async createInvite(actor: AuthenticatedUser, dto: CreateInviteDto): Promise<AdminInviteView & { token: string }> {
    const organizationId = requireOrganizationId(actor);
    const email = dto.email.trim();
    const student = await this.db.getRepository(User).findOne({
      where: { email, organizationId },
    });
    if (!student) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Студент с таким email не найден в вашей организации.',
      });
    }
    if (student.role !== UserRole.STUDENT) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Приглашение на привязку создаётся только для студента.',
      });
    }

    const token = randomBytes(32).toString('base64url');
    const invite = await this.db.getRepository(Invite).save({
      organizationId,
      groupId: dto.groupId ?? student.groupId ?? null,
      studentId: student.id,
      studentEmail: student.email,
      expectedFullName: `${student.firstName} ${student.lastName}`,
      factorType: dto.factorType,
      factorHash: await bcrypt.hash(dto.factorValue, 4),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      attempts: 0,
      maxAttempts: INVITE_MAX_ATTEMPTS,
      createdBy: actor.id,
    });
    return { token, ...this.toAdminView(invite) };
  }

  async listInvites(actor: AuthenticatedUser): Promise<AdminInviteView[]> {
    const organizationId = requireOrganizationId(actor);
    const invites = await this.db.getRepository(Invite).find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return invites.map(invite => this.toAdminView(invite));
  }

  /** FR-ONB-02: a fresh link with a fresh lifetime and cleared claim state. */
  async regenerateInvite(actor: AuthenticatedUser, id: string): Promise<AdminInviteView & { token: string }> {
    const organizationId = requireOrganizationId(actor);
    const repo = this.db.getRepository(Invite);
    const invite = await repo.findOne({ where: { id, organizationId } });
    if (!invite) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Приглашение не найдено.' });
    const token = randomBytes(32).toString('base64url');
    invite.tokenHash = hashToken(token);
    invite.expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    invite.claimedAt = null;
    invite.claimedUserId = null;
    invite.attempts = 0;
    await repo.save(invite);
    return { token, ...this.toAdminView(invite) };
  }

  // ---------------------------------------------------------------- public boundary

  /** TZ 9.2: organization/group/expiry of the invite — never the subject's name. */
  async getPublicInvite(token: string): Promise<PublicInvitePayload> {
    const tokenHash = hashToken(token);
    const invite = await this.tenant.runWithDatabaseAccess(
      { relation: { table: 'invite', column: 'tokenHash', value: tokenHash } },
      () => this.db.getRepository(Invite).findOne({ where: { tokenHash } }),
    );
    if (!invite || invite.claimedAt) throw this.uniformNotFound();
    if (invite.expiresAt.getTime() <= Date.now()) throw this.inviteExpired();

    return this.tenant.runWithDatabaseAccess(
      { tables: ['groups', 'universities'], organizationIds: [invite.organizationId] },
      async () => {
        const university = invite.organizationId
          ? await this.db.getRepository(University).findOne({ where: { id: invite.organizationId } })
          : null;
        const group = invite.groupId
          ? await this.db.getRepository(Group).findOne({ where: { id: invite.groupId } })
          : null;
        return {
          organizationName: university?.name ?? null,
          groupName: group?.name ?? null,
          factorType: invite.factorType,
          expiresAt: invite.expiresAt,
        };
      },
    );
  }

  /**
   * TZ 9.2 public*: claim the invite with the data the student entered plus
   * the second factor, then start the session. Unknown/consumed invites and
   * wrong data/factor share one 404 body (SEC-09); the attempt limit answers
   * 429 `LINK_ATTEMPTS_EXCEEDED` after notifying staff.
   */
  async claim(token: string, dto: ClaimInviteDto, context: TelemetryRequestContext = {}): Promise<AuthResponse> {
    const tokenHash = hashToken(token);
    const user = await this.tenant.runWithDatabaseAccess(
      { relation: { table: 'invite', column: 'tokenHash', value: tokenHash, write: true } },
      async () => {
        const repo = this.db.getRepository(Invite);
        const invite = await repo.findOne({ where: { tokenHash } });
        if (!invite || invite.claimedAt) throw this.uniformNotFound();
        if (invite.expiresAt.getTime() <= Date.now()) throw this.inviteExpired();
        if (invite.attempts >= invite.maxAttempts) throw this.attemptsExceeded();

        const fullNameOk = normalizeFullName(dto.fullName) === normalizeFullName(invite.expectedFullName);
        const factorOk = await bcrypt.compare(dto.factorValue, invite.factorHash);
        if (!fullNameOk || !factorOk) {
          invite.attempts += 1;
          const limited = invite.attempts >= invite.maxAttempts;
          await repo.save(invite);
          if (limited) await this.notifyStaffOfSuspiciousActivity(invite.organizationId, invite.id);
          throw limited ? this.attemptsExceeded() : this.uniformNotFound();
        }

        const user = await this.tenant.runWithDatabaseAccess(
          { tables: ['users'], organizationIds: [invite.organizationId], write: true },
          async () => {
            const users = this.db.getRepository(User);
            const target = invite.studentId
              ? await users.findOne({ where: { id: invite.studentId, organizationId: invite.organizationId } })
              : null;
            if (!target) throw this.uniformNotFound();
            if (!target.isActive) {
              target.isActive = true;
              await users.save(target);
            }
            return target;
          },
        );

        invite.claimedAt = new Date();
        invite.claimedUserId = user.id;
        await repo.save(invite);
        return user;
      },
    );
    return this.auth.loginWithInvite(user, context);
  }

  // ---------------------------------------------------------------- public boundary: link request

  /**
   * TZ 9.2 public*: FR-ONB-04 fallback queue entry. The response is uniform
   * whether or not the email matches an account (SEC-09 no-enumeration).
   */
  async createLinkRequest(dto: CreateLinkRequestDto): Promise<{ status: 'pending' }> {
    const email = dto.studentEmail.trim();
    const subject = await this.tenant.runWithDatabaseAccess({ authentication: { email } }, () =>
      this.db
        .getRepository(User)
        .createQueryBuilder('subject')
        .where('LOWER(subject."email") = LOWER(:email)', { email })
        .getOne(),
    );
    if (subject?.organizationId) {
      await this.tenant.runWithDatabaseAccess(
        { tables: ['link_request'], organizationIds: [subject.organizationId], write: true },
        () =>
          this.db.getRepository(LinkRequest).save({
            organizationId: subject.organizationId!,
            studentEmail: subject.email,
            studentFullName: dto.studentFullName.trim(),
            note: dto.note?.trim() || null,
          }),
      );
    }
    return { status: 'pending' };
  }

  // ---------------------------------------------------------------- staff: link request queue

  async listLinkRequests(actor: AuthenticatedUser): Promise<LinkRequest[]> {
    const organizationId = requireOrganizationId(actor);
    return this.db.getRepository(LinkRequest).find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /** FR-STF-04: approve/reject a queued request; once decided, it stays decided. */
  async decideLinkRequest(actor: AuthenticatedUser, id: string, dto: DecideLinkRequestDto): Promise<LinkRequest> {
    const organizationId = requireOrganizationId(actor);
    const repo = this.db.getRepository(LinkRequest);
    const request = await repo.findOne({ where: { id, organizationId } });
    if (!request) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Заявка не найдена.' });
    if (request.status !== 'pending') {
      throw new ConflictException({ code: 'CONFLICT', message: 'Заявка уже обработана.' });
    }
    request.status = dto.status as LinkRequestStatus;
    request.decidedBy = actor.id;
    request.decidedAt = new Date();
    if (dto.note?.trim()) request.note = dto.note.trim();
    return repo.save(request);
  }

  // ---------------------------------------------------------------- internals

  private uniformNotFound(): NotFoundException {
    return new NotFoundException({ code: 'NOT_FOUND', message: INVITE_UNIFORM_MESSAGE });
  }

  private inviteExpired(): NotFoundException {
    return new NotFoundException({
      code: 'INVITE_EXPIRED',
      message: 'Срок действия приглашения истёк. Запросите новую ссылку у сотрудника.',
    });
  }

  private attemptsExceeded(): HttpException {
    return new HttpException(
      {
        code: 'LINK_ATTEMPTS_EXCEEDED',
        message: 'Слишком много неудачных попыток. Отправьте заявку на привязку или обратитесь к сотруднику.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * SEC-09: notify the organization's staff admins about a suspicious series
   * of failed claims. Never let the notification break the limit response.
   */
  private async notifyStaffOfSuspiciousActivity(organizationId: string, inviteId: string): Promise<void> {
    try {
      const staffIds = await this.tenant.runWithDatabaseAccess(
        { tables: ['users', 'user_role'], organizationIds: [organizationId], write: false },
        async () => {
          const users = await this.db.getRepository(User).find({
            where: { organizationId, isActive: true },
            select: { id: true, role: true },
          });
          const ids = new Set(
            users
              .filter(user => user.role === UserRole.UNIVERSITY_ADMIN || user.role === UserRole.SUPERADMIN)
              .map(user => user.id),
          );
          const memberships = await this.db.getRepository(UserRoleMembership).find({
            where: { organizationId, role: In([UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN]) },
            select: { userId: true },
          });
          for (const membership of memberships) ids.add(membership.userId);
          return [...ids];
        },
      );
      for (const userId of staffIds) {
        await this.notifications.create({
          userId,
          organizationId,
          type: 'system',
          title: 'Подозрительная активность при привязке профиля',
          body: `Серия неудачных попыток подтверждения по приглашению ${inviteId}. Проверьте очередь заявок на привязку.`,
          data: { inviteId },
        });
      }
    } catch (error) {
      this.logger.warn(`Staff alert for invite ${inviteId} failed: ${String(error)}`);
    }
  }

  private toAdminView(invite: Invite): AdminInviteView {
    return {
      id: invite.id,
      studentEmail: invite.studentEmail,
      studentId: invite.studentId,
      groupId: invite.groupId,
      expectedFullName: invite.expectedFullName,
      factorType: invite.factorType,
      expiresAt: invite.expiresAt,
      claimedAt: invite.claimedAt,
      claimedUserId: invite.claimedUserId,
      attempts: invite.attempts,
      maxAttempts: invite.maxAttempts,
      createdAt: invite.createdAt,
    };
  }
}
