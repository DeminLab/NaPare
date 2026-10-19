import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export class PlatformAttachmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
  @ApiPropertyOptional({ enum: ['active', 'revoked', 'all'], default: 'active' })
  @IsOptional() @IsIn(['active', 'revoked', 'all']) status: 'active' | 'revoked' | 'all' = 'active';
}

export class PlatformAttachmentActionDto {
  @ApiPropertyOptional({ description: 'Причина отзыва или восстановления вложения' })
  @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
