import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../auth/interfaces/user-role';
import { PairSpaceController } from './pair-space.controller';

describe('PairSpaceController content write authorization', () => {
  const rolesGuard = new RolesGuard(new Reflector());
  const controller = new PairSpaceController({} as any);

  const contextFor = (handler: Function, role: UserRole) => ({
    getHandler: () => handler,
    getClass: () => PairSpaceController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'user-1', role, universityId: 'university-1' } }),
    }),
  } as any);

  it.each(['createAnnouncement', 'createHomework', 'uploadFile'] as const)(
    'rejects students from %s',
    (method) => {
      expect(() => rolesGuard.canActivate(contextFor(controller[method], UserRole.STUDENT)))
        .toThrow(ForbiddenException);
    },
  );

  it('allows a teacher to create an announcement', () => {
    expect(rolesGuard.canActivate(contextFor(controller.createAnnouncement, UserRole.TEACHER))).toBe(true);
  });
});
