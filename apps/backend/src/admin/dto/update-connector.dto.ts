import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JsonObject } from '../../common/types/json-value.type';

export class UpdateConnectorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  config?: JsonObject;
}
