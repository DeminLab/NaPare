import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateVacancyDto {
  @IsUUID() companyId: string;
  @IsUUID() organizationId: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(160) title: string;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(6000) description: string;
  @IsIn(['job', 'internship']) kind: 'job' | 'internship';
}

export class ReviewVacancyDto {
  @IsIn(['open', 'rejected']) decision: 'open' | 'rejected';
  @Transform(trim) @IsString() @MaxLength(1000) reason: string;
}

export class ProposeInterviewDto {
  @IsISO8601({ strict: true }) @Matches(/T.+(?:Z|[+-]\d\d:\d\d)$/) startsAt: string;
  @IsISO8601({ strict: true }) @Matches(/T.+(?:Z|[+-]\d\d:\d\d)$/) endsAt: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(1000) meetingDetails: string;
}

export class RespondInterviewDto {
  @IsIn(['confirmed', 'declined']) decision: 'confirmed' | 'declined';
  @IsISO8601({ strict: true }) @Matches(/T.+(?:Z|[+-]\d\d:\d\d)$/) updatedAt: string;
}

export class VacancyQuery extends PaginationQueryDto {
  @IsOptional() @IsIn(['student', 'employer', 'center']) workspace?: string;
}
