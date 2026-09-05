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
  @IsEnum(['info', 'warning', 'success', 'error'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  link?: string;
}
