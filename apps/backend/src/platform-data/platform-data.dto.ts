import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlatformQueryDto } from '../platform/platform.dto';

export const PLATFORM_ABSENCE_TYPES = ['learning', 'sick', 'work', 'other_city', 'other'] as const;
export type PlatformAbsenceType = (typeof PLATFORM_ABSENCE_TYPES)[number];

export const PLATFORM_ATTENDANCE_STATUSES = ['present', 'absent', 'late'] as const;
export type PlatformAttendanceStatus = (typeof PLATFORM_ATTENDANCE_STATUSES)[number];

export class PlatformAbsenceQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: PLATFORM_ABSENCE_TYPES })
  @IsOptional()
  @IsIn(PLATFORM_ABSENCE_TYPES)
  type?: PlatformAbsenceType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  confirmationRequired?: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class PlatformAttendanceQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: PLATFORM_ATTENDANCE_STATUSES })
  @IsOptional()
  @IsIn(PLATFORM_ATTENDANCE_STATUSES)
  status?: PlatformAttendanceStatus;

  @ApiPropertyOptional({ format: 'date-time', description: 'Фильтр по дате занятия, начиная с указанного момента.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Фильтр по дате занятия, до указанного момента включительно.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class PlatformAbsenceConfirmationQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'confirmed', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'rejected'])
  status?: 'pending' | 'confirmed' | 'rejected';
}

export class PlatformCorrectionReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 500, description: 'Причина административного исправления.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class PlatformAbsenceCorrectionDto extends PlatformCorrectionReasonDto {
  @ApiPropertyOptional({ enum: PLATFORM_ABSENCE_TYPES })
  @IsOptional()
  @IsIn(PLATFORM_ABSENCE_TYPES)
  type?: PlatformAbsenceType;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmationRequired?: boolean;
}

export class PlatformAttendanceCorrectionDto extends PlatformCorrectionReasonDto {
  @ApiPropertyOptional({ enum: PLATFORM_ATTENDANCE_STATUSES })
  @IsOptional()
  @IsIn(PLATFORM_ATTENDANCE_STATUSES)
  status?: PlatformAttendanceStatus;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

export class PlatformAbsenceConfirmationCorrectionDto extends PlatformCorrectionReasonDto {
  @ApiPropertyOptional({ enum: ['pending', 'confirmed', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'rejected'])
  status?: 'pending' | 'confirmed' | 'rejected';

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  confirmedAt?: string | null;
}
