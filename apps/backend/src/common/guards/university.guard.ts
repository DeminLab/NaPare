import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../auth/interfaces/user-role';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@Injectable()
export class UniversityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params }: { user?: AuthenticatedUser; params: Record<string, string> } = request;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Superadmin can access any university
    if (user.role === UserRole.SUPERADMIN) {
      return true;
    }

    // Check if user is accessing their own university data
    const universityId = params.universityId || params.id;

    if (universityId && user.universityId !== universityId) {
      throw new ForbiddenException('Access denied to this university');
    }

    return true;
  }
}
