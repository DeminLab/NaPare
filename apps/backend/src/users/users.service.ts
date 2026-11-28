import { ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";

import { User } from "./entities/user.entity";
import { Group } from "./entities/group.entity";
import { Faculty } from "./entities/faculty.entity";
import { TelegramLinkChallenge } from "./entities/telegram-link-challenge.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { TenantContext } from "../common/tenant/tenant-context";
import { UserRole } from "../auth/interfaces/user-role";
import { PlatformService } from '../platform/platform.service';
import { DeviceToken } from '../notifications/entities/device-token.entity';
import {
  PaginatedResponse,
  PaginationQueryDto,
  toPaginatedResponse,
} from "../common/dto/pagination-query.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly tenantContext: TenantContext,
    @Optional() @InjectRepository(TelegramLinkChallenge)
    private readonly telegramChallenges?: Repository<TelegramLinkChallenge>,
    @Optional() private readonly platform?: PlatformService,
    @Optional() @InjectRepository(Group)
    private readonly groups?: Repository<Group>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    if (this.tenantContext.getUser() && [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(createUserDto.role)) await this.platform?.protectLegacyRoleCreation(createUserDto.role);
    this.tenantContext.assertAccess(createUserDto.organizationId);
    const user = this.usersRepository.create(createUserDto);
    const saved = await this.usersRepository.save(user);
    await this.syncRoleMembership(saved, false);
    return saved;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (user && this.tenantContext.getUser()?.id !== id) this.tenantContext.assertAccess(user.organizationId);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder("user")
      .where("LOWER(user.email) = LOWER(:email)", { email: email.trim() })
      .getOne();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder("user")
      .where("LOWER(user.username) = LOWER(:username)", { username: username.trim() })
      .getOne();
  }

  async findByMaxUserId(maxUserId: string): Promise<User | null> {
    if (!maxUserId) return null;
    return this.usersRepository.findOne({ where: { maxUserId } });
  }

  async createTelegramLinkChallenge(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    if (!this.telegramChallenges) throw new Error("Telegram linking is unavailable");
    const user = await this.findById(userId);
    if (!user || !user.isActive) throw new NotFoundException("Аккаунт недоступен");
    if (user.telegramUserId) throw new ConflictException("К аккаунту уже привязан Telegram");
    await this.telegramChallenges.manager.transaction(async manager => {
      const challenges = manager.getRepository(TelegramLinkChallenge);
      await manager.query(`DELETE FROM "telegram_link_challenges" WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '1 day' OR "consumedAt" < CURRENT_TIMESTAMP - INTERVAL '1 day'`);
      await manager.query(`SELECT "id" FROM "users" WHERE "id" = $1 FOR UPDATE`, [userId]);
      await challenges.update(
        { userId, consumedAt: IsNull() },
        { consumedAt: new Date() },
      );
      await challenges.save(
        challenges.create({ userId, tokenHash, expiresAt, consumedAt: null }),
      );
    });
  }

  async isTelegramLinked(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return Boolean(user?.telegramUserId);
  }

  async consumeTelegramLinkChallenge(tokenHash: string, telegramUserId: string): Promise<'linked' | 'invalid' | 'already-linked'> {
    try {
      return await this.usersRepository.manager.transaction(async manager => {
        const challenges = manager.getRepository(TelegramLinkChallenge);
        const consumed = await challenges.createQueryBuilder()
          .update(TelegramLinkChallenge)
          .set({ consumedAt: () => 'CURRENT_TIMESTAMP' })
          .where('"tokenHash" = :tokenHash AND "consumedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP', { tokenHash })
          .returning('"userId"')
          .execute();
        const userId = consumed.raw[0]?.userId as string | undefined;
        if (!userId) return 'invalid';

        // The one-time Telegram challenge above establishes this exact identity.
        return this.tenantContext.runWithDatabaseAccess({ authentication: { id: userId, write: true } }, async () => {
        const users = manager.getRepository(User);
        const result = await users.createQueryBuilder()
          .update(User)
          .set({ telegramUserId })
          .where('"id" = :userId AND "isActive" = true AND ("telegramUserId" IS NULL OR "telegramUserId" = :telegramUserId)', { userId, telegramUserId })
          .execute();
        if (result.affected === 1) return 'linked';
        const current = await users.findOne({ where: { id: userId } });
        if (current?.telegramUserId === telegramUserId) return 'linked';
        return 'already-linked';
        });
      });
    } catch (error) {
      const driverCode = (error as { driverError?: { code?: string } })?.driverError?.code;
      if (driverCode === '23505') return 'already-linked';
      throw error;
    }
  }

  async bindMaxUserIdIfUnlinked(id: string, maxUserId: string): Promise<User> {
    const current = await this.findById(id);
    if (!current) throw new NotFoundException(`User with id ${id} not found`);
    if (current.maxUserId === maxUserId) return current;
    if (current.maxUserId) {
      throw new ConflictException("Для этого аккаунта уже привязан другой MAX");
    }

    const result = await this.usersRepository.update(
      { id, maxUserId: IsNull() },
      { maxUserId },
    );
    if (result.affected === 1) {
      const updated = await this.findById(id);
      if (updated) return updated;
    }

    const latest = await this.findById(id);
    if (latest?.maxUserId === maxUserId) return latest;
    throw new ConflictException("Для этого аккаунта уже привязан другой MAX");
  }

  async findByOrganizationId(
    organizationId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
    roles?: UserRole[],
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(organizationId);
    const [data, total] = await this.usersRepository.findAndCount({
      where: { organizationId, ...(roles?.length ? { role: In(roles) } : {}) },
      order: { createdAt: "DESC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findByGroupId(
    groupId: string,
    organizationId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(organizationId);
    const group = await this.groups?.findOne({
      where: { id: groupId, organizationId },
      select: { id: true, externalId: true },
    });
    const groupIds = new Set([groupId]);
    if (group?.externalId) groupIds.add(group.externalId);

    const [data, total] = await this.usersRepository.findAndCount({
      where: { groupId: In([...groupIds]), organizationId },
      order: { lastName: "ASC", firstName: "ASC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }

  async findActiveByOrganizationId(organizationId: string): Promise<User[]> {
    this.tenantContext.assertAccess(organizationId);
    return this.usersRepository.find({
      where: { organizationId, isActive: true },
      order: { lastName: "ASC", firstName: "ASC" },
    });
  }

  async findActiveByGroupId(
    organizationId: string,
    groupId: string,
  ): Promise<User[]> {
    this.tenantContext.assertAccess(organizationId);
    return this.usersRepository.find({
      where: { organizationId, groupId, isActive: true },
      order: { lastName: "ASC", firstName: "ASC" },
    });
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    const actor = this.tenantContext.getUser();
    if (updateData.role !== undefined && actor && (
      [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(actor.role) ||
      [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(updateData.role)
    )) await this.platform?.protectLegacyRoleAssignment(id, updateData.role);
    if (['role', 'isActive', 'passwordHash', 'email', 'username', 'organizationId'].some(key => key in updateData)) await this.platform?.protectLegacyMutation(id);
    if (updateData.role !== undefined) await this.platform?.clearLegacyGrant(id);
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    Object.assign(user, updateData);
    const saved = await this.usersRepository.save(user);
    if (updateData.role !== undefined) await this.syncRoleMembership(saved, true);
    return saved;
  }

  /**
   * ADR-0009 dual-read: effective roles of the active organization. Callers
   * fall back to the legacy `users.role` when no membership row exists, so an
   * account that was never migrated keeps working unchanged.
   */
  async findMembershipRoles(userId: string, organizationId: string | null): Promise<string[]> {
    if (!organizationId) return [];
    const rows = await this.usersRepository.manager.query<Array<{ role: string }>>(
      'SELECT role FROM "user_role" WHERE "userId" = $1 AND "organizationId" = $2',
      [userId, organizationId],
    );
    return rows.map((row) => row.role);
  }

  /**
   * ADR-0009 dual-write: memberships are the source of truth, `users.role`
   * mirrors the active organization's single role. A role change replaces the
   * active organization's rows (never another organization's memberships);
   * creation only adds the missing row.
   */
  private async syncRoleMembership(user: User, replaceActive: boolean): Promise<void> {
    if (!user.organizationId || !user.role) return;
    const { id: userId, organizationId, role } = user;
    await this.usersRepository.manager.transaction(async (manager) => {
      if (replaceActive) {
        await manager.query('DELETE FROM "user_role" WHERE "userId" = $1 AND "organizationId" = $2', [userId, organizationId]);
      }
      await manager.query(
        'INSERT INTO "user_role" ("userId", "organizationId", role) VALUES ($1, $2, $3) ON CONFLICT ("userId", "organizationId", role) DO NOTHING',
        [userId, organizationId, role],
      );
    });
  }

  async bindGroup(id: string, groupId: string): Promise<User> {
    return this.usersRepository.manager.transaction(async manager => {
      const user = await manager.findOne(User, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('Аккаунт недоступен');
      this.tenantContext.assertAccess(user.organizationId);
      if (!user.organizationId || !this.groups) throw new NotFoundException('Группа своего университета не найдена');
      const group = await manager.getRepository(Group).createQueryBuilder('g')
        .where('g.id = :groupId AND g."organizationId" = :organizationId AND g."archivedAt" IS NULL', { groupId, organizationId: user.organizationId })
        .setLock('pessimistic_read').getOne();
      if (!group) throw new NotFoundException('Группа своего университета не найдена');
      const faculty = await manager.getRepository(Faculty).createQueryBuilder('f')
        .where('f.id = :facultyId AND f."organizationId" = :organizationId AND f."archivedAt" IS NULL', { facultyId: group.facultyId, organizationId: user.organizationId })
        .setLock('pessimistic_read').getOne();
      if (!faculty) throw new NotFoundException('Группа своего университета не найдена');
      user.groupId = group.id;
      return manager.save(User, user);
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) return;
    await this.usersRepository.update(user.id, { lastLoginAt: new Date() });
  }

  async invalidateSessions(id: string, options: { afterAuthorizedRoleChange?: boolean } = {}): Promise<void> {
    if (this.tenantContext.getUser()?.id !== id) {
      if (options.afterAuthorizedRoleChange) await this.platform?.protectOwner(id);
      else await this.platform?.protectLegacyMutation(id);
    }
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    await this.usersRepository.manager.transaction(async manager => {
      await manager.increment(User, { id: user.id }, 'sessionVersion', 1);
      await manager.update(DeviceToken, { userId: user.id, provider: 'webpush' }, { isActive: false, webPushRevokedAt: new Date() });
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.platform?.protectLegacyMutation(id);
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    await this.usersRepository.update(user.id, { isActive: false });
  }
}
