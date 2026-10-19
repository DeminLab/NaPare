import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export class PlatformCurationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional({ enum: ['active', 'revoked', 'all'] }) @IsOptional() @IsIn(['active', 'revoked', 'all']) status?: 'active' | 'revoked' | 'all';
}

export class PlatformCurationResourceQueryDto extends PaginationQueryDto {
  @ApiProperty() @IsUUID() universityId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class PlatformCurationAssignmentDto {
  @ApiProperty() @IsUUID() groupId: string;
  @ApiProperty() @IsUUID() userId: string;
  @ApiProperty({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export class PlatformCurationRevokeDto {
  @ApiProperty({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
