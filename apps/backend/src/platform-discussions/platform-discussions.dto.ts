import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PlatformQueryDto } from '../platform/platform.dto';

export class PlatformDiscussionQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['visible', 'hidden'] })
  @IsOptional() @IsIn(['visible', 'hidden'])
  state?: 'visible' | 'hidden';

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  authorId?: string;
}

export class PlatformDiscussionPatchDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString() @MinLength(1) @MaxLength(4000)
  text: string;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}

export class PlatformDiscussionModerationDto {
  @ApiProperty({ enum: ['visible', 'hidden'] })
  @IsIn(['visible', 'hidden'])
  state: 'visible' | 'hidden';

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}
