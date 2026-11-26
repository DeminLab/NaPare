import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScheduleConnectorConfigDto {
  @ApiPropertyOptional({ example: '2026-2027' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{4}$/)
  academicYear?: string;
}

export class UpdateScheduleConnectorDto {
  @ApiProperty({ enum: ['rasp-sano', 'file-only'] })
  @IsIn(['rasp-sano', 'file-only'])
  provider: 'rasp-sano' | 'file-only';

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ type: ScheduleConnectorConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleConnectorConfigDto)
  config?: ScheduleConnectorConfigDto;
}
