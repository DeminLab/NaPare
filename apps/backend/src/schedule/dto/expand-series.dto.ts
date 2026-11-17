import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class ExpandSeriesDto {
  @ApiProperty({ example: '2026-09-01', description: 'Начало периода в формате YYYY-MM-DD' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-12-31', description: 'Конец периода в формате YYYY-MM-DD' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ default: false, description: 'Только показать план, ничего не создавать' })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
