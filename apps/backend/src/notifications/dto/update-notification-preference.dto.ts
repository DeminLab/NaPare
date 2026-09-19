import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  scheduleChanges?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cancellations?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  roomChanges?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  homeworkCreated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deadlines?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  messages?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  announcements?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  systemAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quietHoursStart?: string;

  @ApiPropertyOptional({ example: '07:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quietHoursEnd?: string;
}
