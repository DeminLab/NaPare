import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

export function requireOrganizationId(user: Pick<AuthenticatedUser, 'organizationId'> | undefined): string {
  if (!user?.organizationId) throw new ForbiddenException('Для этого раздела необходима привязка к вузу');
  return user.organizationId;
}
