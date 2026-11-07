import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export const ANALYTICS_GRANULARITIES = ['day', 'week', 'month'] as const;
export type AnalyticsGranularity = typeof ANALYTICS_GRANULARITIES[number];

export class AnalyticsOverviewQueryDto {
  @ApiPropertyOptional({ description: 'Начало периода, ISO 8601' })
  @IsOptional() @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Конец периода включительно, ISO 8601' })
  @IsOptional() @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: ANALYTICS_GRANULARITIES, default: 'day' })
  @IsOptional() @IsIn(ANALYTICS_GRANULARITIES)
  granularity?: AnalyticsGranularity;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  universityId?: string;
}

export class TelemetryEventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['auth', 'request', 'error', 'ui', 'admin', 'system']) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['backend', 'web', 'android', 'max', 'api']) source?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['debug', 'info', 'warning', 'error', 'critical']) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
}

export class MonitoredUserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['active', 'blocked']) status?: 'active' | 'blocked';
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
}

export class SessionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['web', 'android', 'max', 'api', 'backend']) client?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['true', 'false']) active?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
}

export class RevokeSessionDto {
  @ApiPropertyOptional({ description: 'Причина принудительного завершения сессии' })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}
