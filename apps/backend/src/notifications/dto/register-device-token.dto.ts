import { IsString, IsOptional, IsEnum, MaxLength, IsIn } from 'class-validator';
import { DEVICE_PROVIDERS, DeviceProvider } from '../delivery/push-providers';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEVICE_PLATFORMS, DevicePlatform } from '../entities/device-token.entity';

export class RegisterDeviceTokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(8192)
  token: string;

  @ApiPropertyOptional({ enum: DEVICE_PROVIDERS, default: 'legacy' })
  @IsOptional()
  @IsIn(DEVICE_PROVIDERS)
  provider?: DeviceProvider;

  @ApiProperty()
  @IsEnum(DEVICE_PLATFORMS)
  platform: DevicePlatform;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string;
}
