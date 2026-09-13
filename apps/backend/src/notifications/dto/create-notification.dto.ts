import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  data?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum([
    'schedule_change',
    'new_announcement',
    'new_homework',
    'new_file',
    'deadline',
    'absence_decision',
    'new_absence',
    'system',
    'other',
  ])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deepLink?: string;
}
