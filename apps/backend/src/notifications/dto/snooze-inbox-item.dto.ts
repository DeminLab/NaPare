import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class SnoozeInboxItemDto {
  @ApiProperty({ example: '2026-09-20T08:00:00.000Z' })
  @IsDateString()
  until: string;
}
