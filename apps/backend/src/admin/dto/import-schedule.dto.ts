import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportScheduleRowDto {
  @ApiProperty({ example: '2026-09-26' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @ApiProperty({ example: '10:30' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  pairNumber: number;

  @ApiProperty({ example: 'Математика' })
  @IsString()
  subject: string;

  @ApiProperty({ example: 'ПИ-21' })
  @IsString()
  group: string;

  @ApiPropertyOptional({ example: 'Иванов И.И.' })
  @IsOptional()
  @IsString()
  teacher?: string;

  @ApiPropertyOptional({ example: '305' })
  @IsOptional()
  @IsString()
  room?: string;
}

export class ImportScheduleDto {
  @ApiProperty({ example: 'schedule-september.csv' })
  @IsString()
  fileName: string;

  @ApiProperty({ enum: ['csv', 'json'] })
  @IsEnum(['csv', 'json'])
  format: string;

  @ApiProperty({ type: () => [ImportScheduleRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportScheduleRowDto)
  rows: ImportScheduleRowDto[];
}
