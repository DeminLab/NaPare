import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export class PlatformAttendanceQrQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
  @ApiPropertyOptional({ enum: ['active', 'expired', 'revoked', 'all'] }) @IsOptional() @IsIn(['active', 'expired', 'revoked', 'all']) status?: 'active' | 'expired' | 'revoked' | 'all';
}

export class RevokeAttendanceQrDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
