import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ScheduleRangeV2QueryDto {
  @ApiProperty({ example: '2026-11-16', description: 'Начало периода YYYY-MM-DD' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-11-22', description: 'Конец периода YYYY-MM-DD' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ description: 'Фильтр по группе. У студента игнорируется в пользу своей группы.' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ description: 'Фильтр по преподавателю. Преподаватель всегда видит только свои занятия.' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
