import { IsEmail, IsString, IsOptional, IsUUID, IsEnum, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../auth/interfaces/user-role';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  passwordHash: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  sourceTeacherId?: string | null;
}
