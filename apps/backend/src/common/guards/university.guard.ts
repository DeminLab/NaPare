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

    // Superadmin can access any university
    if (user.role === UserRole.SUPERADMIN) {
      return true;
    }

    // Resource IDs (lesson, user, request) are never university IDs. A route
    // without :universityId still requires an authenticated university scope;
    // resource ownership must additionally be checked by its service.
    if (!user.universityId) {
      throw new ForbiddenException('Для этого раздела необходима привязка к вузу');
    }
    const universityId = params.universityId;

    if (universityId && user.universityId !== universityId) {
      throw new ForbiddenException('Access denied to this university');
    }

    return true;
  }
}
