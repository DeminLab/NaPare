import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ACADEMIC_EVENT_TYPES, AcademicEventType } from '../academic.types';

export class AcademicEventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ACADEMIC_EVENT_TYPES })
  @IsOptional()
  @IsEnum(ACADEMIC_EVENT_TYPES)
  type?: AcademicEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
