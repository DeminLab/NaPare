import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException, Injectable } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../auth/interfaces/user-role';

@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<AuthenticatedUser>();

  setUser(user: AuthenticatedUser): void {
    this.storage.enterWith(user);
  }

  getUser(): AuthenticatedUser | undefined {
    return this.storage.getStore();
  }

  assertAccess(universityId: string): void {
    const user = this.getUser();
    if (user && user.role !== UserRole.SUPERADMIN && user.universityId !== universityId) {
      throw new ForbiddenException('Access denied to this university');
    }
  }
}
