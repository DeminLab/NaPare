import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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

  @ApiPropertyOptional({ example: '12131', description: 'UUID локальной группы или внешний числовой ID группы СИБИТ из каталога rasp.sano.ru' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  groupId?: string;

  @ApiPropertyOptional({ example: '20', description: 'Внешний числовой ID преподавателя в каталоге расписания СИБИТ' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  sourceTeacherId?: string;
}
