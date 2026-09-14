import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** Common offset pagination contract for collection endpoints. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit = DEFAULT_PAGE_SIZE;
}

export class PaginationMetaDto {
  @ApiPropertyOptional({ example: 1 })
  page: number;

  @ApiPropertyOptional({ example: 50 })
  limit: number;

  @ApiPropertyOptional({ example: 137 })
  total: number;

  @ApiPropertyOptional({ example: 3 })
  totalPages: number;
}

export class PaginatedResponseDto {
  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  data: unknown[];

  @ApiPropertyOptional({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMetaDto;
}

export function toPaginatedResponse<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationQueryDto,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
