import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

export function requireUniversityId(user: Pick<AuthenticatedUser, 'universityId'> | undefined): string {
  if (!user?.universityId) throw new ForbiddenException('Для этого раздела необходима привязка к вузу');
  return user.universityId;
}
