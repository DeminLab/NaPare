import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../auth/interfaces/user-role';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@Injectable()
export class UniversityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params = {} }: { user?: AuthenticatedUser; params?: Record<string, string> } = request;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Developer and superadmin can access any university. Resource ownership
    // is still checked by the endpoint service.
    if ([UserRole.DEVELOPER, UserRole.SUPERADMIN].includes(user.role)) {
      return true;
    }

    // Resource IDs (lesson, user, request) are never university IDs. A route
    // without :organizationId still requires an authenticated university scope;
    // resource ownership must additionally be checked by its service.
    if (!user.organizationId) {
      throw new ForbiddenException('Для этого раздела необходима привязка к вузу');
    }
    const organizationId = params.organizationId;

    if (organizationId && user.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied to this university');
    }

    return true;
  }
}
