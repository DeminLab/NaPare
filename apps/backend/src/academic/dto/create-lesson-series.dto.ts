import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateLessonSeriesDto {
  @ApiProperty()
  @IsUUID()
  groupId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectType?: string;

  @ApiPropertyOptional({ default: 'weekly' })
  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @ApiProperty({ minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: '10:45' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '12:15' })
  @IsString()
  endTime: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  pairNumber: number;

  @ApiPropertyOptional({ enum: ['odd', 'even', 'both'] })
  @IsOptional()
  @IsIn(['odd', 'even', 'both'])
  weekType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  building?: string;

  @ApiProperty()
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;
}
