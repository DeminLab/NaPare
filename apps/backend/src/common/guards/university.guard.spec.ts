import { ExecutionContext } from '@nestjs/common';

import { UniversityGuard } from './university.guard';
import { UserRole } from '../../auth/interfaces/user-role';

function contextFor(user: { role: UserRole; universityId: string | null } | undefined, params?: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
}

describe('UniversityGuard', () => {
  const guard = new UniversityGuard();

  it('denies a university admin access to another university', () => {
    expect(() => guard.canActivate(contextFor(
      { role: UserRole.UNIVERSITY_ADMIN, universityId: 'uni-1' },
      { universityId: 'uni-2' },
    ))).toThrow('Access denied to this university');
  });

  it('allows a university admin to access their own university', () => {
    expect(guard.canActivate(contextFor(
      { role: UserRole.UNIVERSITY_ADMIN, universityId: 'uni-1' },
      { universityId: 'uni-1' },
    ))).toBe(true);
  });

  it('allows superadmin to access any university', () => {
    expect(guard.canActivate(contextFor(
      { role: UserRole.SUPERADMIN, universityId: 'uni-1' },
      { universityId: 'uni-2' },
    ))).toBe(true);
  });

  it('denies requests without an authenticated actor', () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow('User not authenticated');
  });

  it.each<Record<string, string>>([{}, { id: 'lesson-in-another-university' }, { universityId: 'uni-1' }])(
    'denies an actor without a university for params %j', (params) => {
      expect(() => guard.canActivate(contextFor(
        { role: UserRole.UNIVERSITY_ADMIN, universityId: null }, params,
      ))).toThrow('необходима привязка к вузу');
    },
  );

  it('uses the authenticated university when a route has no university parameter', () => {
    expect(guard.canActivate(contextFor(
      { role: UserRole.UNIVERSITY_ADMIN, universityId: 'uni-1' },
    ))).toBe(true);
  });

  it('does not confuse a resource id with the university id', () => {
    expect(guard.canActivate(contextFor(
      { role: UserRole.UNIVERSITY_ADMIN, universityId: 'uni-1' },
      { id: 'lesson-1' },
    ))).toBe(true);
  });
});
