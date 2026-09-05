import { IsEmail, IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';

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

  @IsEnum([
    'student',
    'teacher',
    'curator',
    'faculty_dean',
    'department_head',
    'university_admin',
    'superadmin',
    'developer',
  ])
  role: string;

  @IsUUID()
  universityId: string;
}
