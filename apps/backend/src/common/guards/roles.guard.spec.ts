import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { UserRole } from '../../auth/interfaces/user-role';

function contextFor(user: { role: UserRole } | undefined): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  beforeEach(() => jest.clearAllMocks());

  it.each(Object.values(UserRole))('allows the canonical role %s', (role) => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([role]);
    expect(guard.canActivate(contextFor({ role }))).toBe(true);
  });

  it('denies students on admin endpoints', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.UNIVERSITY_ADMIN,
      UserRole.SUPERADMIN,
    ]);
    expect(() => guard.canActivate(contextFor({ role: UserRole.STUDENT }))).toThrow(
      'Insufficient permissions',
    );
  });

  it('denies teachers on developer endpoints', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.DEVELOPER]);
    expect(() => guard.canActivate(contextFor({ role: UserRole.TEACHER }))).toThrow(
      'Insufficient permissions',
    );
  });

  it('allows superadmin on explicitly protected superadmin endpoints', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.SUPERADMIN]);
    expect(guard.canActivate(contextFor({ role: UserRole.SUPERADMIN }))).toBe(true);
  });
});
