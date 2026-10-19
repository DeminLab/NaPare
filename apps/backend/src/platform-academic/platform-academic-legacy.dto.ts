import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, Matches, IsIn } from 'class-validator';

export class PlatformAcademicLessonsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
  @ApiPropertyOptional({ description: 'ISO date or date-time; inclusive lower bound on startDate' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ description: 'ISO date or date-time; inclusive upper bound on startDate' }) @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 50, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

export class PlatformAcademicLessonPatchDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() groupId?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() teacherId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(255) subject?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) subjectType?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) room?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) building?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(6) dayOfWeek?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) pairNumber?: number;
  @ApiPropertyOptional({ enum: ['odd', 'even', 'both'] }) @IsOptional() @IsIn(['odd', 'even', 'both']) weekType?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) teacherName?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) groupName?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) subgroup?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) department?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(255) faculty?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isChanged?: boolean;
  @ApiPropertyOptional({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
