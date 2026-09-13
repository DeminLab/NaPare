import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConnectorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  config?: Record<string, any>;
}
