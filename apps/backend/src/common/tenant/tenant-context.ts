import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException, Injectable } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../auth/interfaces/user-role';

@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<{ user?: AuthenticatedUser }>();

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

  assertAccess(universityId: string): void {
    const user = this.getUser();
    if (user && user.role !== UserRole.SUPERADMIN && user.universityId !== universityId) {
      throw new ForbiddenException('Access denied to this university');
    }
  }
}
