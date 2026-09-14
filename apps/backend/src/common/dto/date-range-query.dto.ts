import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { PaginationQueryDto } from './pagination-query.dto';

export class DateRangeQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: '2026-09-14' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-09-20' })
  @IsDateString()
  endDate: string;
}
