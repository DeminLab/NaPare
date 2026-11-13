import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WeekTypeQueryDto {
  @ApiProperty({ example: '2026-10-23' })
  @IsDateString()
  date: string;
}
