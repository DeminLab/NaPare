import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JsonObject } from '../../common/types/json-value.type';
import { NOTIFICATION_TYPES, NotificationAction, NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  universityId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  data?: JsonObject;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(NOTIFICATION_TYPES)
  type?: NotificationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deepLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  actions?: NotificationAction[];
}
