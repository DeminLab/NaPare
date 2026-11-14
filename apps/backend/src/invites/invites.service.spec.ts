import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

import { InvitesService } from './invites.service';
import { Invite } from './entities/invite.entity';
import { LinkRequest } from './entities/link-request.entity';
import { User } from '../users/entities/user.entity';
import { UserRoleMembership } from '../users/entities/user-role.entity';
import { Group } from '../users/entities/group.entity';
import { University } from '../users/entities/university.entity';
import { TenantContext } from '../common/tenant/tenant-context';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../auth/interfaces/user-role';
import { INVITE_MAX_ATTEMPTS, INVITE_UNIFORM_MESSAGE } from './invites.constants';
import { CreateInviteDto } from './dto/create-invite.dto';
import { ClaimInviteDto } from './dto/claim-invite.dto';
import { CreateLinkRequestDto } from './dto/create-link-request.dto';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('InvitesService', () => {
  let service: InvitesService;
  let inviteRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock };
  let userRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };
  let roleRepo: { find: jest.Mock };
  let linkRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock };
  let universityRepo: { findOne: jest.Mock };
  let groupRepo: { findOne: jest.Mock };
  let auth: { loginWithInvite: jest.Mock };
  let notifications: { create: jest.Mock };
  let tenant: { runWithDatabaseAccess: jest.Mock };

  const admin = {
    id: 'admin-1',
    email: 'admin@invite.test',
    role: UserRole.UNIVERSITY_ADMIN,
    organizationId: 'org-1',
  };
  const student = {
    id: 'student-1',
    email: 'anna@invite.test',
    firstName: 'Анна',
    lastName: 'Иванова',
    role: UserRole.STUDENT,
    organizationId: 'org-1',
    groupId: 'group-1',
    isActive: true,
  };

  const buildInvite = (overrides: Partial<Invite> = {}): Invite => ({
    id: 'invite-1',
    organizationId: 'org-1',
    groupId: 'group-1',
    studentId: student.id,
    studentEmail: student.email,
    expectedFullName: 'Анна Иванова',
    factorType: 'student_card',
    factorHash: bcrypt.hashSync('CARD-12345', 4),
    tokenHash: sha256('known-token'),
    expiresAt: new Date(Date.now() + 86_400_000),
    claimedAt: null,
    claimedUserId: null,
    attempts: 0,
    maxAttempts: INVITE_MAX_ATTEMPTS,
    createdBy: admin.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    inviteRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (row: Invite) => ({ ...row, id: row.id ?? 'invite-new' })),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue({ ...student }),
      find: jest.fn().mockResolvedValue([{ id: admin.id, role: UserRole.UNIVERSITY_ADMIN }]),
      save: jest.fn(async (row: User) => row),
      createQueryBuilder: jest.fn(),
    };
    roleRepo = { find: jest.fn().mockResolvedValue([]) };
    linkRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (row: Partial<LinkRequest>) => ({ id: 'link-1', ...row })),
    };
    universityRepo = { findOne: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Тестовый вуз' }) };
    groupRepo = { findOne: jest.fn().mockResolvedValue({ id: 'group-1', name: 'ИН-25' }) };
    auth = { loginWithInvite: jest.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }) };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    tenant = { runWithDatabaseAccess: jest.fn((_access, callback: () => unknown) => callback()) };

    const db = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Invite) return inviteRepo;
        if (entity === User) return userRepo;
        if (entity === UserRoleMembership) return roleRepo;
        if (entity === LinkRequest) return linkRepo;
        if (entity === University) return universityRepo;
        if (entity === Group) return groupRepo;
        throw new Error('Unexpected repository');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: DataSource, useValue: db },
        { provide: TenantContext, useValue: tenant },
        { provide: AuthService, useValue: auth },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(InvitesService);
  });

  it('stores only the token hash and bcrypt factor hash in createInvite', async () => {
    const dto: CreateInviteDto = { email: student.email, factorType: 'student_card', factorValue: 'CARD-12345' };
    const result = await service.createInvite(admin, dto);

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const saved = inviteRepo.save.mock.calls[0][0] as Invite;
    expect(saved.tokenHash).toBe(sha256(result.token));
    expect(saved.tokenHash).not.toBe(result.token);
    expect(await bcrypt.compare('CARD-12345', saved.factorHash)).toBe(true);
    expect(saved.expectedFullName).toBe('Анна Иванова');
    expect(saved.attempts).toBe(0);
    expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
    expect(saved.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 14 * 86_400_000 + 1000);
  });

  it('rejects invites for unknown students and non-students', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(
      service.createInvite(admin, { email: 'ghost@invite.test', factorType: 'student_card', factorValue: 'CARD-12345' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    userRepo.findOne.mockResolvedValue({ ...student, role: UserRole.TEACHER });
    await expect(
      service.createInvite(admin, { email: student.email, factorType: 'student_card', factorValue: 'CARD-12345' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns public fields only and never the entered full name', async () => {
    inviteRepo.findOne.mockResolvedValue(buildInvite());
    const payload = await service.getPublicInvite('known-token');
    expect(payload).toEqual({
      organizationName: 'Тестовый вуз',
      groupName: 'ИН-25',
      factorType: 'student_card',
      expiresAt: expect.any(Date),
    });
    expect(JSON.stringify(payload)).not.toContain('Иванова');
  });

  const captureError = async (run: () => Promise<unknown>): Promise<HttpException> => {
    try {
      await run();
    } catch (error) {
      return error as HttpException;
    }
    throw new Error('Expected the call to reject');
  };

  it('answers unknown tokens and consumed invites with one uniform 404', async () => {
    inviteRepo.findOne.mockResolvedValue(null);
    const unknown = await captureError(() => service.claim('no-such-token', { fullName: 'Анна Иванова', factorValue: 'CARD-12345' }));

    inviteRepo.findOne.mockResolvedValue(buildInvite({ claimedAt: new Date() }));
    const consumed = await captureError(() => service.claim('known-token', { fullName: 'Анна Иванова', factorValue: 'CARD-12345' }));

    inviteRepo.findOne.mockResolvedValue(buildInvite());
    const wrongFactor = await captureError(() => service.claim('known-token', { fullName: 'Анна Иванова', factorValue: 'WRONG' }));

    inviteRepo.findOne.mockResolvedValue(buildInvite());
    const wrongName = await captureError(() => service.claim('known-token', { fullName: 'Пётр Петров', factorValue: 'CARD-12345' }));

    for (const error of [unknown, consumed, wrongFactor, wrongName]) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toEqual({ code: 'NOT_FOUND', message: INVITE_UNIFORM_MESSAGE });
    }
    expect(wrongFactor.getResponse()).toEqual(unknown.getResponse());
    expect(wrongName.getResponse()).toEqual(unknown.getResponse());
  });

  it('marks expired invites INVITE_EXPIRED before checking the factor', async () => {
    inviteRepo.findOne.mockResolvedValue(buildInvite({ expiresAt: new Date(Date.now() - 1000) }));
    const error = await captureError(() => service.claim('known-token', { fullName: 'x', factorValue: 'y' }));
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toMatchObject({ code: 'INVITE_EXPIRED' });
  });

  it('locks at the attempt limit with 429 LINK_ATTEMPTS_EXCEEDED and alerts staff', async () => {
    const invite = buildInvite();
    inviteRepo.findOne.mockResolvedValue(invite);
    const dto: ClaimInviteDto = { fullName: 'Анна Иванова', factorValue: 'WRONG' };

    for (let attempt = 1; attempt < INVITE_MAX_ATTEMPTS; attempt += 1) {
      const rejection = await captureError(() => service.claim('known-token', dto));
      expect(rejection).toBeInstanceOf(NotFoundException);
      expect(invite.attempts).toBe(attempt);
    }

    const limitError = await captureError(() => service.claim('known-token', dto));
    expect(limitError.getStatus()).toBe(429);
    expect(limitError.getResponse()).toMatchObject({ code: 'LINK_ATTEMPTS_EXCEEDED' });
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: admin.id, organizationId: 'org-1' }),
    );
  });

  it('completes a valid claim, marks it consumed and starts the session', async () => {
    const invite = buildInvite();
    inviteRepo.findOne.mockResolvedValue(invite);
    const result = await service.claim('known-token', { fullName: '  анна   иванова ', factorValue: 'CARD-12345' });

    expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    expect(invite.claimedAt).toBeInstanceOf(Date);
    expect(invite.claimedUserId).toBe(student.id);
    expect(auth.loginWithInvite).toHaveBeenCalledWith(expect.objectContaining({ id: student.id }), {});
  });

  it('creates a link request for known accounts and answers uniformly otherwise', async () => {
    userRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ ...student }),
    });
    const dto: CreateLinkRequestDto = { studentEmail: student.email, studentFullName: 'Анна Иванова', note: 'Помогите' };
    await expect(service.createLinkRequest(dto)).resolves.toEqual({ status: 'pending' });
    expect(linkRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', studentFullName: 'Анна Иванова' }),
    );

    userRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.createLinkRequest({ ...dto, studentEmail: 'ghost@invite.test' }),
    ).resolves.toEqual({ status: 'pending' });
    expect(linkRepo.save).toHaveBeenCalledTimes(1);
  });

  it('keeps staff decisions one-shot', async () => {
    const pending = { id: 'link-1', organizationId: 'org-1', status: 'pending' } as LinkRequest;
    linkRepo.findOne.mockResolvedValue(pending);
    linkRepo.save.mockImplementation(async (row: LinkRequest) => row);

    const decided = await service.decideLinkRequest(admin, 'link-1', { status: 'approved' });
    expect(decided.status).toBe('approved');
    expect(decided.decidedBy).toBe(admin.id);

    linkRepo.findOne.mockResolvedValue({ ...pending, status: 'approved' });
    await expect(service.decideLinkRequest(admin, 'link-1', { status: 'rejected' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    linkRepo.findOne.mockResolvedValue(null);
    await expect(service.decideLinkRequest(admin, 'link-2', { status: 'approved' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('never lists secret invite columns to staff', async () => {
    inviteRepo.find.mockResolvedValue([buildInvite()]);
    const [view] = await service.listInvites(admin);
    expect(Object.keys(view)).not.toContain('tokenHash');
    expect(Object.keys(view)).not.toContain('factorHash');
    expect(view.expectedFullName).toBe('Анна Иванова');
  });

  it('regenerates a fresh token and resets claim state', async () => {
    inviteRepo.findOne.mockResolvedValue(buildInvite({ claimedAt: new Date(), attempts: 5 }));
    const first = await service.regenerateInvite(admin, 'invite-1');
    expect(first.token).not.toBe('known-token');
    const saved = inviteRepo.save.mock.calls.at(-1)![0] as Invite;
    expect(saved.tokenHash).toBe(sha256(first.token));
    expect(saved.claimedAt).toBeNull();
    expect(saved.attempts).toBe(0);
  });
});
