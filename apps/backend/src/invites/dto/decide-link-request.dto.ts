import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { LINK_REQUEST_STATUSES } from '../entities/link-request.entity';

/** FR-STF-04: staff decision on a queued linkage request. */
export class DecideLinkRequestDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Заметка сотрудника по решению' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** Re-export keeps the entity enum visible to route consumers of this DTO. */
export { LINK_REQUEST_STATUSES };
