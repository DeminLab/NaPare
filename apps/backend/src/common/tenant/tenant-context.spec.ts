import { ForbiddenException } from '@nestjs/common';

import { TenantContext } from './tenant-context';
import { UserRole } from '../../auth/interfaces/user-role';

describe('TenantContext', () => {
  it('allows user A to access a resource in university A', () => {
    const context = new TenantContext();
    context.setUser({ id: 'a', email: 'a@example.com', role: UserRole.STUDENT, universityId: 'uni-a' });

    expect(() => context.assertAccess('uni-a')).not.toThrow();
  });

  it('denies user A from accessing a resource in university B', () => {
    const context = new TenantContext();
    context.setUser({ id: 'a', email: 'a@example.com', role: UserRole.STUDENT, universityId: 'uni-a' });

    expect(() => context.assertAccess('uni-b')).toThrow(ForbiddenException);
  });

  it('denies a university admin from accessing university B', () => {
    const context = new TenantContext();
    context.setUser({
      id: 'admin-a', email: 'admin@example.com', role: UserRole.UNIVERSITY_ADMIN, universityId: 'uni-a',
    });

    expect(() => context.assertAccess('uni-b')).toThrow(ForbiddenException);
  });

  it('allows superadmin to access university B', () => {
    const context = new TenantContext();
    context.setUser({
      id: 'root', email: 'root@example.com', role: UserRole.SUPERADMIN, universityId: 'uni-a',
    });

    expect(() => context.assertAccess('uni-b')).not.toThrow();
  });
});

describe('TenantContext request scope', () => {
  const makeUser = (id: string) => ({ id, email: `${id}@napare.test`, role: UserRole.UNIVERSITY_ADMIN, universityId: id });

  it('retains the authenticated actor after an asynchronous guard completes', async () => {
    const context = new TenantContext();
    await context.runInRequest(async () => {
      await Promise.resolve().then(() => context.setUser(makeUser('first')));
      expect(context.getUser()?.id).toBe('first');
    });
    expect(context.getUser()).toBeUndefined();
  });

  it('isolates overlapping requests and enforces their university boundaries', async () => {
    const context = new TenantContext();
    await Promise.all(['first', 'second'].map(id => context.runInRequest(async () => {
      await Promise.resolve().then(() => context.setUser(makeUser(id)));
      await new Promise(resolve => setImmediate(resolve));
      expect(context.getUser()?.id).toBe(id);
      expect(() => context.assertAccess(id)).not.toThrow();
      expect(() => context.assertAccess(id === 'first' ? 'second' : 'first')).toThrow();
    })));
    expect(context.getUser()).toBeUndefined();
  });
});
