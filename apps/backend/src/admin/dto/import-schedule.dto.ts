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
  IsBoolean,
  IsUUID,
  MaxLength,
  ValidateIf,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportScheduleRowDto {
  @ApiPropertyOptional({ description: 'Стабильный ID источника' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  id?: string;
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
  @MaxLength(100)
  fileName: string;

  @ApiProperty({ enum: ['csv', 'json', 'ics', 'xlsx', 'sibit', 'moodle'] })
  @IsEnum(['csv', 'json', 'ics', 'xlsx', 'sibit', 'moodle'])
  format: string;

  @ApiProperty({ type: () => [ImportScheduleRowDto] })
  @ValidateIf(dto => dto.content === undefined && !['sibit', 'moodle'].includes(dto.format))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportScheduleRowDto)
  rows?: ImportScheduleRowDto[];

  @ApiPropertyOptional({ description: 'UTF-8 CSV/ICS/JSON, либо base64 XLSX' })
  @IsOptional() @IsString() @MaxLength(2800000)
  content?: string;

  @ApiPropertyOptional({ description: 'Логическое имя источника, одинаковое при повторной загрузке' })
  @IsOptional() @IsString() @Matches(/^[\p{L}\p{N}_. -]{1,100}$/u)
  sourceKey?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  queued?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Мягко отменить отсутствующие записи этого источника в явно указанном диапазоне/группах' })
  @IsOptional() @IsBoolean()
  replace?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  startDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsString({ each: true })
  groupNames?: string[];

  @ApiPropertyOptional({ example: '+06:00', description: 'Для CSV/XLSX/Moodle; по умолчанию +00:00' })
  @IsOptional() @IsString() @Matches(/^[+-](?:0\d|1[0-4]):[0-5]\d$/)
  utcOffset?: string;

  @ApiPropertyOptional({ description: 'Группа ICS при отсутствии X-NAPARE-GROUP' })
  @IsOptional() @IsString() @MaxLength(200)
  groupName?: string;

  @ApiPropertyOptional({ description: 'Номер пары ICS при отсутствии X-NAPARE-PAIR-NUMBER' })
  @IsOptional() @IsInt() @Min(1)
  pairNumber?: number;
}
