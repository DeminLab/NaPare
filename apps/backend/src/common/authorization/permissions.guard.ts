import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { hasPermission, Permission } from './permissions';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    // ADR-0009: any effective role of the active organization may carry the permission.
    const effectiveRoles = user?.roles?.length ? user.roles : user ? [user.role] : [];
    if (!user || !required.every((permission) => effectiveRoles.some((role) => hasPermission(role, permission)))) {
      throw new ForbiddenException('Permission required');
    }
    return true;
  }
}
