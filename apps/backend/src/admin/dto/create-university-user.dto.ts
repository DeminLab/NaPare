import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserRole } from '../../auth/interfaces/user-role';

export class CreateUniversityUserDto {
  @ApiProperty({ example: 'student@university.ru' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'temporary-password-2026' })
  @IsString()
  @MinLength(10)
  password: string;

  @ApiProperty({ example: 'Анна' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Иванова' })
  @IsString()
  lastName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.STUDENT })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'uuid-of-group' })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
