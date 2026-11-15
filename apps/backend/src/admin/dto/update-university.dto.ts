import { IsString, IsOptional, IsObject, IsEnum, IsInt, Min, Max } from 'class-validator';
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
  connectorConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Порог массового изменения расписания в процентах (FR-IMP-08); пустой снимок подтверждается всегда',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  importMassChangeThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['active', 'inactive', 'pending'])
  status?: string;
}
