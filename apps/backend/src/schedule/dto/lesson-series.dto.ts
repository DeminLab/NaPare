import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateLessonSeriesDto {
  @ApiProperty()
  @IsUUID()
  groupId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiProperty({ description: 'Учебный курс, к которому относится серия' })
  @IsUUID()
  courseId: string;

  @ApiPropertyOptional({ example: 'Математика' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'lecture' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  subjectType?: string;

  @ApiProperty({ example: 1, description: 'День недели, 1 = понедельник … 7 = воскресенье' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: '10:00' })
  @Matches(TIME_PATTERN, { message: 'Время начала в формате ЧЧ:ММ' })
  startTime: string;

  @ApiProperty({ example: '11:30' })
  @Matches(TIME_PATTERN, { message: 'Время окончания в формате ЧЧ:ММ' })
  endTime: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(10)
  pairNumber: number;

  @ApiPropertyOptional({ enum: ['odd', 'even', 'both'], default: 'both' })
  @IsOptional()
  @IsIn(['odd', 'even', 'both'])
  weekType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  room?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  building?: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  validFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  validTo?: string;
}

export class UpdateLessonSeriesDto extends PartialType(CreateLessonSeriesDto) {}

export class LessonSeriesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
