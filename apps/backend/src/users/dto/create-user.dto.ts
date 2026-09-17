import { IsEmail, IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { UserRole } from '../../auth/interfaces/user-role';

export class CreateUserDto {
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
  universityId: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}
