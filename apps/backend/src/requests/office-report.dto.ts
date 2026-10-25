import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, Equals, IsArray, IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

const canonicalUuid = ({ value }: { value: unknown }) => typeof value === 'string' ? value.toLowerCase() : value;

export class OfficeReportQueryDto extends PaginationQueryDto {
  @IsOptional() @Transform(canonicalUuid) @IsUUID() groupId?: string;
  @IsOptional() @Transform(canonicalUuid) @IsUUID() facultyId?: string;
}
export class OfficeDebtRowDto {
  @Transform(canonicalUuid) @IsUUID() studentId: string;
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) subject: string;
  @IsString() @MinLength(1) @MaxLength(80) @Matches(/\S/) period: string;
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) basis: string;
}
export class OfficeDebtImportDto {
  @Transform(canonicalUuid) @IsUUID() requestId: string;
  @Transform(canonicalUuid) @IsUUID() groupId: string;
  @IsString() @MinLength(3) @MaxLength(200) @Matches(/\S/) source: string;
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) reference: string;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) asOfDate: string;
  @Equals(true) confirmsOfficialSource: true;
  @Equals(true) confirmsCompleteGroupSnapshot: true;
  @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => OfficeDebtRowDto) records: OfficeDebtRowDto[];
}
