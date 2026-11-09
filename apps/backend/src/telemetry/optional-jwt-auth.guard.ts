import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { TenantContext } from '../common/tenant/tenant-context';

/**
 * Attributes anonymous client telemetry when a valid session is present, but
 * never turns an absent or expired token into a failed beacon.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly tenant: TenantContext) {
    super();
  }

  handleRequest<TUser = AuthenticatedUser>(error: unknown, user: TUser | false | null, _info?: unknown, _context?: ExecutionContext): TUser | null {
    if (error || !user) return null;
    this.tenant.setUser(user as unknown as AuthenticatedUser);
    return user;
  }
}
