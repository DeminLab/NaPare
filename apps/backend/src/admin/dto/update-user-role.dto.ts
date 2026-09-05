import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: [
      'student',
      'teacher',
      'curator',
      'faculty_dean',
      'department_head',
      'university_admin',
    ],
  })
  @IsEnum([
    'student',
    'teacher',
    'curator',
    'faculty_dean',
    'department_head',
    'university_admin',
  ])
  role: string;
}
