import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { UserRole } from '../../auth/interfaces/user-role';

function contextFor(user: { role: UserRole; roles?: UserRole[] } | undefined): ExecutionContext {
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

  it('authorizes when any effective role of the active organization matches', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.FACULTY_DEAN]);
    expect(
      guard.canActivate(contextFor({ role: UserRole.STUDENT, roles: [UserRole.STUDENT, UserRole.FACULTY_DEAN] })),
    ).toBe(true);
  });

  it('denies when the effective role set carries none of the required roles', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.FACULTY_DEAN]);
    expect(() =>
      guard.canActivate(contextFor({ role: UserRole.STUDENT, roles: [UserRole.STUDENT, UserRole.TEACHER] })),
    ).toThrow('Insufficient permissions');
  });
});
