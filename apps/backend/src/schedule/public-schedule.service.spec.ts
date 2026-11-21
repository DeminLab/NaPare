import { NotFoundException } from '@nestjs/common';
import { PublicScheduleService } from './public-schedule.service';
import { UserRole } from '../auth/interfaces/user-role';

const tenantContext = () => ({
  runWithDatabaseAccess: jest.fn(async (_scope: unknown, callback: () => unknown) => callback()),
});

const build = (options: {
  university?: Record<string, unknown> | null;
  group?: Record<string, unknown> | null;
  schedule?: { days: Array<{ lessons: Array<Record<string, unknown>> }> };
} = {}) => {
  const tenant = tenantContext();
  const universities = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(options.university === undefined ? { id: 'uni-a' } : options.university),
  };
  const groups = {
    findOne: jest.fn().mockResolvedValue(options.group === undefined ? { id: 'group-a' } : options.group),
  };
  const scheduleRead = {
    readRange: jest.fn().mockResolvedValue(options.schedule ?? { days: [{ lessons: [] }] }),
  };
  return {
    service: new PublicScheduleService(tenant as never, universities as never, groups as never, scheduleRead as never),
    tenant, universities, groups, scheduleRead,
  };
};

describe('PublicScheduleService', () => {
  it('lists only active universities with explicit public publication enabled', async () => {
    const { service, universities, tenant } = build();
    await service.listUniversities();

    expect(universities.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'active', publicScheduleEnabled: true },
    }));
    expect(tenant.runWithDatabaseAccess).toHaveBeenCalledWith(
      expect.objectContaining({ tables: ['universities'], organizationIds: null }),
      expect.any(Function),
    );
  });

  it('rejects groups and lessons for a university that did not opt into publication', async () => {
    const { service, groups, scheduleRead } = build({ university: null });

    await expect(service.listGroups('uni-a')).rejects.toThrow(NotFoundException);
    await expect(service.listLessons({ organizationId: 'uni-a', groupId: 'group-a', from: '2026-11-23', to: '2026-11-29' } as never))
      .rejects.toThrow(NotFoundException);
    expect(groups.findOne).not.toHaveBeenCalled();
    expect(scheduleRead.readRange).not.toHaveBeenCalled();
  });

  it('requires the selected group to belong to the published university', async () => {
    const { service, groups, scheduleRead } = build({ group: null });

    await expect(service.listLessons({ organizationId: 'uni-a', groupId: 'group-b', from: '2026-11-23', to: '2026-11-29' } as never))
      .rejects.toThrow(NotFoundException);
    expect(groups.findOne).toHaveBeenCalledWith({
      where: { id: 'group-b', organizationId: 'uni-a' },
      select: { id: true },
    });
    expect(scheduleRead.readRange).not.toHaveBeenCalled();
  });

  it('reads one tenant group and omits cancelled lessons from the public result', async () => {
    const { service, scheduleRead, tenant } = build({
      schedule: { days: [{ lessons: [
        { id: 'lesson:1', lessonId: '1', date: '2026-11-23', startTime: '09:00', endTime: '10:00', pairNumber: 1, subject: 'Математика', weekType: 'odd', state: 'scheduled', isReplacement: false },
        { id: 'lesson:2', lessonId: '2', date: '2026-11-23', startTime: '10:00', endTime: '11:00', pairNumber: 2, subject: 'Физика', weekType: 'both', state: 'cancelled', isReplacement: false },
      ] }] },
    });

    await expect(service.listLessons({ organizationId: 'uni-a', groupId: 'group-a', from: '2026-11-23', to: '2026-11-29' } as never))
      .resolves.toEqual([expect.objectContaining({ subject: 'Математика', weekType: 'odd', isReplacement: false })]);
    expect(scheduleRead.readRange).toHaveBeenCalledWith(
      { id: 'public-schedule', role: UserRole.STUDENT, organizationId: 'uni-a', groupId: 'group-a' },
      { from: '2026-11-23', to: '2026-11-29', groupId: 'group-a' },
    );
    expect(tenant.runWithDatabaseAccess).toHaveBeenCalledWith(
      expect.objectContaining({ organizationIds: ['uni-a'], replaceActor: true }),
      expect.any(Function),
    );
  });
});
