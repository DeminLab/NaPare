import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { EventPriority } from '../events/event.types';

const EVENT_PRIORITIES: EventPriority[] = ['low', 'normal', 'high', 'urgent'];

export class PlatformEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Поиск по типу, ID цели, университету и allowlist полям payload' })
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  universityId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional() @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: EVENT_PRIORITIES })
  @IsOptional() @IsIn(EVENT_PRIORITIES)
  priority?: EventPriority;
}
