import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserRole } from '../../auth/interfaces/user-role';

export class CreateUniversityUserDto {
  @ApiProperty({ example: 'student.in25', minLength: 3, maxLength: 32 })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username: string;

  @ApiPropertyOptional({ example: 'teacher@university.ru', nullable: true, description: 'Email обязателен для большинства ролей; преподавателю можно не указывать.' })
  @Transform(({ value }) => typeof value === 'string' && value.trim() === '' ? null : value)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiProperty({ example: 'temporary-password-2026', minLength: 6 })
  @IsString()
  @MinLength(6)
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
