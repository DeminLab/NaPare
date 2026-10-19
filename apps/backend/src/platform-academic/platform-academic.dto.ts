import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { LESSON_OCCURRENCE_STATUSES } from '../academic/academic.types';

export class PlatformAcademicOccurrencesQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
  @ApiPropertyOptional({ description: 'ISO date or date-time; inclusive lower bound on startsAt' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ description: 'ISO date or date-time; exclusive upper bound on startsAt' }) @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ enum: [...LESSON_OCCURRENCE_STATUSES, 'all'] }) @IsOptional() @IsIn([...LESSON_OCCURRENCE_STATUSES, 'all']) status?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 50, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

export class PlatformAcademicOccurrencePatchDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) room?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) building?: string | null;
  @ApiPropertyOptional({ enum: LESSON_OCCURRENCE_STATUSES }) @IsOptional() @IsIn(LESSON_OCCURRENCE_STATUSES) status?: string;
  @ApiPropertyOptional({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
