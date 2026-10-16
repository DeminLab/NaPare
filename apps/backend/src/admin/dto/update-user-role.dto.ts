import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/interfaces/user-role';

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: UserRole,
    description: 'Основная роль. Кураторство назначается через /curation без замены роли; curator сохранён только для прежних аккаунтов.',
  })
  @IsEnum(UserRole)
  role: UserRole;
}
