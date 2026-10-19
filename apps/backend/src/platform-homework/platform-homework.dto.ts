import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PlatformQueryDto } from '../platform/platform.dto';

export const PLATFORM_HOMEWORK_SUBMISSION_STATUSES = ['not_submitted', 'submitted'] as const;
export type PlatformHomeworkSubmissionStatus = (typeof PLATFORM_HOMEWORK_SUBMISSION_STATUSES)[number];

export class PlatformHomeworkSubmissionQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: PLATFORM_HOMEWORK_SUBMISSION_STATUSES })
  @IsOptional()
  @IsIn(PLATFORM_HOMEWORK_SUBMISSION_STATUSES)
  status?: PlatformHomeworkSubmissionStatus;

  @ApiPropertyOptional({ format: 'date-time', description: 'Фильтр по дате сдачи, начиная с указанного момента.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Фильтр по дате сдачи, до указанного момента включительно.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class PlatformHomeworkSubmissionPatchDto {
  @ApiPropertyOptional({ enum: PLATFORM_HOMEWORK_SUBMISSION_STATUSES })
  @IsOptional()
  @IsIn(PLATFORM_HOMEWORK_SUBMISSION_STATUSES)
  status?: PlatformHomeworkSubmissionStatus;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, description: 'Дата сдачи; null допустим только для not_submitted.' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateString()
  submittedAt?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  fileUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  comment?: string | null;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
