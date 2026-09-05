import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceTokenDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsEnum(['ios', 'android', 'web'])
  platform: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string;
}
