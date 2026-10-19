import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, Equals, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { PlatformQueryDto } from '../platform/platform.dto';
import { CareerAvailabilityDto, CareerQuestionDto } from '../career/career.dto';

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

export class PlatformCareerCompanyQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'verified', 'rejected'] })
  @IsOptional() @IsIn(['pending', 'verified', 'rejected'])
  partnershipState?: string;
}

export class PlatformCareerMembershipQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'revoked'] })
  @IsOptional() @IsIn(['active', 'revoked'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: ['career_admin', 'career_staff', 'company_owner', 'company_member'] })
  @IsOptional() @IsIn(['career_admin', 'career_staff', 'company_owner', 'company_member'])
  role?: string;
}

export class PlatformCareerTransferOwnerDto extends PlatformCareerReasonDto {
  @ApiProperty()
  @IsUUID()
  targetMembershipId: string;
}

export class PlatformCareerTestQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['passed', 'failed'] })
  @IsOptional() @IsIn(['passed', 'failed'])
  outcome?: string;
}

export class PlatformCareerTestPatchDto extends PlatformCareerReasonDto {
  @ApiPropertyOptional({ minLength: 5, maxLength: 180 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MinLength(5) @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @ValidateIf((_, value) => value !== undefined) @IsInt() @Min(1) @Max(100)
  passingPercent?: number;

  @ApiPropertyOptional({ type: [CareerQuestionDto], minItems: 3, maxItems: 20 })
  @IsOptional() @IsArray() @ArrayMinSize(3) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CareerQuestionDto)
  questions?: CareerQuestionDto[];
}

export class PlatformCareerPortfolioQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['published', 'private'] })
  @IsOptional() @IsIn(['published', 'private'])
  visibility?: string;
}

export class PlatformCareerPortfolioPatchDto extends PlatformCareerReasonDto {
  @ApiPropertyOptional({ maxLength: 8000 })
  @IsOptional() @IsString() @MaxLength(8000)
  caseText?: string;

  @ApiPropertyOptional({ description: 'Только обратимое скрытие публичного кейса' })
  @IsOptional() @Equals(true)
  hide?: true;
}

export class PlatformCareerReviewQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['allowed', 'withheld'] })
  @IsOptional() @IsIn(['allowed', 'withheld'])
  consent?: string;
}

export class PlatformCareerReviewPatchDto extends PlatformCareerReasonDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @ValidateIf((_, value) => value !== undefined) @IsInt() @Min(1) @Max(5)
  rating?: number;

  @ApiPropertyOptional({ minLength: 10, maxLength: 4000 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MinLength(10) @MaxLength(4000)
  body?: string;
}

export class PlatformCareerNoticeQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['read', 'unread'] })
  @IsOptional() @IsIn(['read', 'unread'])
  readState?: string;
}

export class PlatformCareerNoticePatchDto extends PlatformCareerReasonDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MinLength(1) @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isRead?: boolean;
}

export class PlatformCareerAvailabilityQueryDto extends PlatformQueryDto {}

export class PlatformCareerAvailabilityPatchDto extends CareerAvailabilityDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString() @MinLength(3) @MaxLength(500)
  reason: string;
}

export class PlatformCareerCompanyPatchDto extends PlatformCareerReasonDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MinLength(2) @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ maxLength: 4000 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(4000)
  description?: string;
}

export class PlatformCareerPartnershipQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'verified', 'rejected'] })
  @IsOptional() @IsIn(['pending', 'verified', 'rejected'])
  state?: string;
}

export class PlatformCareerPartnershipDecisionDto extends PlatformCareerReasonDto {
  @ApiProperty({ enum: ['verified', 'rejected'] })
  @IsIn(['verified', 'rejected'])
  decision: 'verified' | 'rejected';
}

export class PlatformCareerTaskQueryDto extends PlatformQueryDto {
  @ApiPropertyOptional({ enum: ['draft', 'review', 'open', 'assigned', 'submitted', 'accepted', 'revision', 'closed'] })
  @IsOptional() @IsIn(['draft', 'review', 'open', 'assigned', 'submitted', 'accepted', 'revision', 'closed'])
  state?: string;
}

export class PlatformCareerTaskPatchDto extends PlatformCareerReasonDto {
  @ApiPropertyOptional({ minLength: 5, maxLength: 180 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MinLength(5) @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({ minLength: 20, maxLength: 10000 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MinLength(20) @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 4000 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MinLength(10) @MaxLength(4000)
  criteria?: string;

  @ApiPropertyOptional({ minimum: 100, maximum: 100000000 })
  @ValidateIf((_, value) => value !== undefined) @IsInt() @Min(100) @Max(100000000)
  rewardKopecks?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 500 })
  @ValidateIf((_, value) => value !== undefined) @IsInt() @Min(1) @Max(500)
  hours?: number;

  @ApiPropertyOptional({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @ValidateIf((_, value) => value !== undefined) @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deadline?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined) @IsBoolean()
  profiled?: boolean;

  @ApiPropertyOptional({ maxLength: 80 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(80)
  skill?: string;

  @ApiPropertyOptional({ enum: ['starter', 'standard', 'advanced'] })
  @ValidateIf((_, value) => value !== undefined) @IsIn(['starter', 'standard', 'advanced'])
  level?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(2000)
  requirements?: string;
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
