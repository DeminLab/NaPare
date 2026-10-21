import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException, Injectable } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../auth/interfaces/user-role';
import { TenantDatabaseAccess } from './tenant-database-access';

@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<{ user?: AuthenticatedUser; databaseAccess?: TenantDatabaseAccess[] }>();

  runWithDatabaseAccess<T>(access: TenantDatabaseAccess, callback: () => T): T {
    const current = this.storage.getStore();
    return this.storage.run({ ...current, databaseAccess: [...(current?.databaseAccess ?? []), access] }, callback);
  }

  /** Call only after checking the persisted platform grant for this request. */
  authorizeDatabaseAccess(access: TenantDatabaseAccess): void {
    const context = this.storage.getStore();
    if (!context?.user) throw new ForbiddenException('Database grants require an authenticated request');
    (context.databaseAccess ??= []).push(access);
  }

  getDatabaseAccess(): readonly TenantDatabaseAccess[] {
    return this.storage.getStore()?.databaseAccess ?? [];
  }

  runInRequest<T>(callback: () => T): T {
    return this.storage.run({}, callback);
  }

  setUser(user: AuthenticatedUser): void {
    const context = this.storage.getStore();
    if (context) context.user = user;
    else this.storage.enterWith({ user });
  }

  getUser(): AuthenticatedUser | undefined {
    return this.storage.getStore()?.user;
  }

  assertAccess(universityId: string | null): void {
    const user = this.getUser();
    if (user && user.role !== UserRole.SUPERADMIN && (!universityId || !user.universityId || user.universityId !== universityId)) {
      throw new ForbiddenException('Access denied to this university');
    }
  }
}
