import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { LESSON_OCCURRENCE_STATUSES } from '../academic.types';

export class CreateLessonOccurrenceDto {
  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ enum: LESSON_OCCURRENCE_STATUSES })
  @IsOptional()
  @IsIn(LESSON_OCCURRENCE_STATUSES)
  status?: (typeof LESSON_OCCURRENCE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changeReason?: string;
}
