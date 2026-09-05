import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAbsenceDto {
  @ApiProperty()
  @IsUUID()
  universityId: string;

  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiProperty()
  @IsDateString()
  date: Date;

  @ApiProperty()
  @IsNumber()
  pairNumber: number;

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['absent', 'late', 'excused', 'pending'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
