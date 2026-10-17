import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PlatformQueryDto } from '../platform/platform.dto';

export class PlatformCareerOperationQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'selected', 'not_selected', 'withdrawn', 'in_progress', 'submitted', 'revision', 'accepted'] })
  @IsOptional() @IsIn(['pending', 'selected', 'not_selected', 'withdrawn', 'in_progress', 'submitted', 'revision', 'accepted'])
  state?: string;
}

export class PlatformCareerOperationPatchDto {
  @ApiPropertyOptional({ minLength: 10, maxLength: 4000 })
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MinLength(10) @MaxLength(4000)
  message?: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(10000)
  submission?: string;

  @ApiPropertyOptional({ maxLength: 2000, description: 'HTTPS-ссылка без логина и пароля' })
  @ValidateIf((_object, value) => value !== undefined) @IsString() @MaxLength(2000)
  resultUrl?: string;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}

export class PlatformCareerApplicationDecisionDto {
  @ApiProperty({ enum: ['selected', 'not_selected'] })
  @IsIn(['selected', 'not_selected'])
  decision: 'selected' | 'not_selected';

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}

export class PlatformCareerWorkDecisionDto {
  @ApiProperty({ enum: ['accepted', 'revision'] })
  @IsIn(['accepted', 'revision'])
  decision: 'accepted' | 'revision';

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}
