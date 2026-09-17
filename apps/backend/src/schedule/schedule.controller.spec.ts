import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../auth/interfaces/user-role';
import { ScheduleController } from './schedule.controller';

describe('ScheduleController write authorization', () => {
  const rolesGuard = new RolesGuard(new Reflector());
  const controller = new ScheduleController({} as any);

  const contextFor = (handler: Function, role: UserRole) => ({
    getHandler: () => handler,
    getClass: () => ScheduleController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'user-1', role, universityId: 'university-1' } }),
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
});
