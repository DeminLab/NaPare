import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUniversityDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  connectorType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  connectorConfig?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['active', 'inactive', 'pending'])
  status?: string;
}
