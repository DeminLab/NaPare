import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUniversityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

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
