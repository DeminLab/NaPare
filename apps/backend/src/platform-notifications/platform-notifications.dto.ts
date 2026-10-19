import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export const PLATFORM_NOTIFICATION_KINDS = ['notification', 'inbox'] as const;
export type PlatformNotificationKind = (typeof PLATFORM_NOTIFICATION_KINDS)[number];

export class PlatformNotificationQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: PLATFORM_NOTIFICATION_KINDS })
  @IsIn(PLATFORM_NOTIFICATION_KINDS)
  kind: PlatformNotificationKind;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  universityId?: string;

  @ApiPropertyOptional({ description: 'Для уведомлений: read/unread. Для inbox: open/snoozed/done.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

export class PlatformDeviceTokenQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class PlatformNotificationPatchDto {
  @ApiPropertyOptional({ enum: ['open', 'snoozed', 'done'] })
  @IsOptional()
  @IsIn(['open', 'snoozed', 'done'])
  status?: 'open' | 'snoozed' | 'done';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @ApiPropertyOptional({ maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 2048 })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2048)
  deepLink?: string | null;

  @ApiPropertyOptional({ enum: ['low', 'normal', 'high', 'urgent'] })
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateString()
  dueAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateString()
  completedAt?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateString()
  readAt?: string | null;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class PlatformReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
