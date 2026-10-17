import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlatformQueryDto } from '../platform/platform.dto';

export class PlatformCareerProfileQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'verified', 'rejected'] })
  @IsOptional() @IsIn(['pending', 'verified', 'rejected'])
  verification?: string;
}

export class PlatformCareerAdmissionQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] })
  @IsOptional() @IsIn(['pending', 'approved', 'rejected'])
  state?: string;
}

export class PlatformCareerReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}

export class PlatformCareerProfilePatchDto extends PlatformCareerReasonDto {
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180)
  headline?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional() @IsString() @MaxLength(4000)
  about?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 20, maxLength: 80 })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) @MaxLength(80, { each: true })
  skills?: string[];
}

export class PlatformCareerAdmissionPatchDto extends PlatformCareerReasonDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  skill?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional() @IsString() @MinLength(10) @MaxLength(4000)
  evidence?: string;
}

export class PlatformCareerDecisionDto extends PlatformCareerReasonDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';
}
