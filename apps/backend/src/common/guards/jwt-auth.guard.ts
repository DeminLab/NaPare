import { Injectable, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../../auth/interfaces/user-role';
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
    const actor = user as unknown as AuthenticatedUser;
    if (([UserRole.EMPLOYER, UserRole.CAREER_STAFF, UserRole.CAREER_ADMIN].includes(actor.role) || !actor.universityId) && _context) {
      const request = _context.switchToHttp().getRequest<{ originalUrl?: string; url?: string }>();
      const path = (request.originalUrl || request.url || '').split('?')[0];
      if (/^\/api\/v1\/platform(?:\/|$)/.test(path) && [UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(actor.role)) {
        this.tenantContext.setUser(actor);
        return user;
      }
      if (!/^\/api\/v1\/career(?:\/|$)/.test(path) && !['/api/v1/users/me', '/api/v1/users/me/export', '/api/v1/users/me/deletion-preview', '/api/v1/devices/webpush'].includes(path) && !['/api/v1/auth/logout','/api/v1/auth/max/status','/api/v1/auth/max/link'].includes(path)) throw new ForbiddenException('Для этого раздела необходима привязка к вузу');
    }
    this.tenantContext.setUser(user);
    return user;
  }
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return typeof value === 'object' && value !== null && 'id' in value && 'role' in value && 'universityId' in value;
}
