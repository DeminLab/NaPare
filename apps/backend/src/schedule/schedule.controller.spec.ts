import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../auth/interfaces/user-role';
import { ScheduleController } from './schedule.controller';

describe('ScheduleController write authorization', () => {
  const rolesGuard = new RolesGuard(new Reflector());
  const controller = new ScheduleController({} as any, {} as any, {} as any, {} as any);

  const contextFor = (handler: Function, role: UserRole) => ({
    getHandler: () => handler,
    getClass: () => ScheduleController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'user-1', role, organizationId: 'university-1' } }),
    }),
  } as any);

  it.each(['create', 'update', 'delete'] as const)(
    'rejects students from %s schedule writes',
    (method) => {
      expect(() => rolesGuard.canActivate(contextFor(controller[method], UserRole.STUDENT)))
        .toThrow(ForbiddenException);
    },
  );

  it('allows a university administrator to create a lesson', () => {
    expect(rolesGuard.canActivate(contextFor(controller.create, UserRole.UNIVERSITY_ADMIN))).toBe(true);
  });

  it('uses the authenticated teacher id for a range instead of exposing the university schedule', async () => {
    const scheduleService = { findByTeacherDateRange: jest.fn().mockResolvedValue({ data: [], meta: {} }) };
    const scopedController = new ScheduleController(scheduleService as any, {} as any, {} as any, {} as any);
    const query = { startDate: '2026-09-26', endDate: '2026-10-02' } as any;

    await scopedController.findByDateRange({ user: { id: 'teacher-1', role: UserRole.TEACHER, organizationId: 'uni-1' } }, query);

    expect(scheduleService.findByTeacherDateRange).toHaveBeenCalledWith('uni-1', 'teacher-1', '2026-09-26', '2026-10-02', query);
  });

  it('uses the authenticated user when opening a single lesson', async () => {
    const scheduleService = { findAccessibleById: jest.fn().mockResolvedValue({ id: 'lesson-1' }) };
    const scopedController = new ScheduleController(scheduleService as any, {} as any, {} as any, {} as any);
    const req = { user: { id: 'teacher-1', role: UserRole.TEACHER, organizationId: 'uni-1' } };

    await scopedController.findLesson('lesson-1', req);

    expect(scheduleService.findAccessibleById).toHaveBeenCalledWith('lesson-1', req.user);
  });

  it('derives the weekday for a dry-run conflict check from the start date', async () => {
    const scheduleService = { findConflicts: jest.fn().mockResolvedValue([]) };
    const scopedController = new ScheduleController(scheduleService as any, {} as any, {} as any, {} as any);
    const dto = {
      lessonId: 'lesson-1',
      groupId: 'group-1',
      startDate: '2026-11-16',
      endDate: '2026-11-16',
      startTime: '10:00',
      endTime: '11:30',
    };

    const result = await scopedController.validate(
      { user: { id: 'dispatcher-1', role: UserRole.CURATOR, organizationId: 'uni-1' } },
      dto as any,
    );

    expect(scheduleService.findConflicts).toHaveBeenCalledWith(
      { ...dto, dayOfWeek: 1, organizationId: 'uni-1' },
      'lesson-1',
    );
    expect(result).toEqual({ ok: true, conflicts: [] });
  });

  it('keeps an explicit weekday instead of the start date one', async () => {
    const scheduleService = { findConflicts: jest.fn().mockResolvedValue([]) };
    const scopedController = new ScheduleController(scheduleService as any, {} as any, {} as any, {} as any);

    await scopedController.validate(
      { user: { id: 'dispatcher-1', role: UserRole.CURATOR, organizationId: 'uni-1' } },
      { groupId: 'group-1', dayOfWeek: 0, startDate: '2026-11-16', endDate: '2026-11-16', startTime: '10:00', endTime: '11:30' } as any,
    );

    expect(scheduleService.findConflicts).toHaveBeenCalledWith(
      expect.objectContaining({ dayOfWeek: 0 }),
      undefined,
    );
  });
});
