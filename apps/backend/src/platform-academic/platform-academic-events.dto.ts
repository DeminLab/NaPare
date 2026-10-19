import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ACADEMIC_EVENT_TYPES, AcademicEventType } from '../academic/academic.types';

export class PlatformAcademicEventsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
  @ApiPropertyOptional({ enum: ACADEMIC_EVENT_TYPES }) @IsOptional() @IsEnum(ACADEMIC_EVENT_TYPES) type?: AcademicEventType;
  @ApiPropertyOptional({ enum: ['visible', 'hidden', 'all'], default: 'visible' }) @IsOptional() @IsIn(['visible', 'hidden', 'all']) visibility: 'visible' | 'hidden' | 'all' = 'visible';
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 50, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

export class PlatformAcademicEventPatchDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(255) title?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(10000) description?: string | null;
  @ApiPropertyOptional({ enum: ['low', 'normal', 'high', 'urgent'] }) @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: 'low' | 'normal' | 'high' | 'urgent';
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() startsAt?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() endsAt?: string | null;
  @ApiPropertyOptional({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export class PlatformAcademicEventReasonDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
