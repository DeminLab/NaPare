import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** FR-ONB-04: the fallback linkage request a student sends after a failed claim. */
export class CreateLinkRequestDto {
  @ApiProperty({ description: 'Email студента' })
  @IsEmail()
  studentEmail: string;

  @ApiProperty({ description: 'ФИО, введённое заявкой' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  studentFullName: string;

  @ApiPropertyOptional({ description: 'Комментарий заявителя' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
