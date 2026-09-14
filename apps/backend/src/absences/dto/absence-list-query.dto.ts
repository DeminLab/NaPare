import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AbsenceListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['pending'] })
  @IsOptional()
  @IsIn(['pending'])
  status?: 'pending';
}
