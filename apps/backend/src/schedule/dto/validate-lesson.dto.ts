import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * Dry-run payload for conflict detection. It carries only the fields that
 * decide a clash, so a dispatcher can check a room/time change without
 * resending the whole lesson.
 */
export class ValidateLessonDto {
  @ApiPropertyOptional({ description: 'Изменяемое занятие. Не участвует в проверке.' })
  @IsOptional()
  @IsUUID()
  lessonId?: string;

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
  room?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ description: 'День недели в той же нумерации, что хранится в занятии.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  dayOfWeek?: number;

  @ApiProperty({ example: '2026-11-16' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-11-16' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '11:30' })
  @IsString()
  endTime: string;

  @ApiPropertyOptional({ enum: ['odd', 'even', 'both'] })
  @IsOptional()
  @IsIn(['odd', 'even', 'both'])
  weekType?: string;
}
