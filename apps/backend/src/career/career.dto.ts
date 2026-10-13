import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, Matches, IsArray, ArrayMinSize, ValidateNested, ArrayMaxSize, Equals } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmployerRegistrationDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(128) password: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) firstName: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) lastName: string;
}
export class CareerCompanyDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name: string;
  @ApiProperty() @IsString() @MaxLength(4000) description: string;
  @ApiProperty() @IsUUID() universityId: string;
}
export class CareerProfileDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(180) headline: string;
  @ApiProperty() @IsString() @MaxLength(4000) about: string;
  @ApiProperty() @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @MaxLength(80,{each:true}) skills: string[];
}
export class CareerAdmissionDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) skill: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(4000) evidence: string;
}
export class CareerTaskDto {
  @ApiProperty() @IsUUID() companyId: string;
  @ApiProperty() @IsUUID() universityId: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(180) title: string;
  @ApiProperty() @IsString() @MinLength(20) @MaxLength(10000) description: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(4000) criteria: string;
  @ApiProperty() @IsInt() @Min(100) @Max(100000000) rewardKopecks: number;
  @ApiProperty() @IsInt() @Min(1) @Max(500) hours: number;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) deadline: string;
  @ApiProperty() @IsBoolean() profiled: boolean;
  @ApiProperty() @IsString() @MaxLength(80) skill: string;
}
export class CareerMessageDto { @ApiProperty() @IsString() @MinLength(10) @MaxLength(4000) message: string; }
export class CareerSubmissionDto {
  @ApiProperty() @IsString() @MinLength(20) @MaxLength(10000) submission: string;
  @ApiProperty() @IsString() @MaxLength(2000) resultUrl: string;
}
export class CareerDecisionDto {
  @ApiProperty() @IsIn(['accepted','revision','approved','rejected']) decision: string;
  @ApiProperty() @IsString() @MaxLength(4000) reason: string;
}
export class CareerReviewDto {
  @ApiProperty() @IsInt() @Min(1) @Max(5) rating: number;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(4000) body: string;
  @ApiProperty() @IsBoolean() publishAllowed: boolean;
}
export class CareerPublishDto { @ApiProperty() @IsBoolean() published: boolean; }
export class CareerMembershipDto {
  @ApiProperty({required:false}) @IsOptional() @IsUUID() userId?: string;
  @ApiProperty({required:false}) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({required:false}) @IsOptional() @IsBoolean() identityConfirmed?: boolean;
  @ApiProperty() @IsOptional() @IsUUID() companyId?: string;
  @ApiProperty() @IsIn(['career_staff','career_admin','company_member']) role: string;
}
export class CareerPartnershipDto { @ApiProperty() @IsUUID() universityId: string; }

export class CareerQuestionDto {
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(2000) prompt:string;
  @ApiProperty() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(6) @IsString({each:true}) @MinLength(1,{each:true}) @MaxLength(500,{each:true}) options:string[];
  @ApiProperty() @IsInt() @Min(0) @Max(5) answer:number;
}
export class CareerTestDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) skill:string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(180) title:string;
  @ApiProperty() @IsInt() @Min(1) @Max(100) passingPercent:number;
  @ApiProperty({type:[CareerQuestionDto]}) @IsArray() @ArrayMinSize(3) @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>CareerQuestionDto) questions:CareerQuestionDto[];
}
export class CareerAttemptDto {
  @ApiProperty() @IsArray() @ArrayMinSize(3) @ArrayMaxSize(20) @IsInt({each:true}) @Min(0,{each:true}) @Max(5,{each:true}) answers:number[];
}

export class CareerAiConsentDto {
  @ApiProperty() @IsBoolean() @Equals(true) consent: boolean;
}
export class CareerAiTaskDto extends CareerAiConsentDto {
  @ApiProperty() @IsUUID() companyId: string;
  @ApiProperty() @IsString() @MinLength(20) @MaxLength(4000) brief: string;
}
export class CareerCaseTextDto {
  @ApiProperty() @IsString() @MaxLength(8000) caseText: string;
}
