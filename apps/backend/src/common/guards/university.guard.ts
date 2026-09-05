import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class UniversityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params } = request;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Superadmin can access any university
    if (user.role === 'superadmin') {
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
