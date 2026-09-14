import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantContext } from '../tenant/tenant-context';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly tenantContext: TenantContext) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    error: unknown,
    user: TUser | false | null,
    _info?: unknown,
    _context?: ExecutionContext,
    _status?: number,
  ): TUser {
    if (error instanceof Error) throw error;
    if (!isAuthenticatedUser(user)) {
      throw new UnauthorizedException();
    }
    this.tenantContext.setUser(user);
    return user;
  }
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return typeof value === 'object' && value !== null && 'id' in value && 'role' in value && 'universityId' in value;
}
