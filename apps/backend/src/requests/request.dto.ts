import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { OFFICE_DUTIES, OfficeDuty, REQUEST_STATUSES, REQUEST_TYPES, RequestStatus, RequestType } from './request.entities';

export class OfficeAssignmentDto {
  @ApiProperty() @IsUUID() userId: string;
  @ApiProperty({ enum: OFFICE_DUTIES }) @IsIn(OFFICE_DUTIES) duty: OfficeDuty;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsUUID('all', { each: true }) facultyIds: string[];
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsUUID('all', { each: true }) groupIds: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canCreateForStudents?: boolean;
}
export class OfficeRouteDto {
  @ApiProperty() @IsUUID() groupId: string;
  @ApiProperty({ enum: REQUEST_TYPES }) @IsIn(REQUEST_TYPES) type: RequestType;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(3) @IsUUID('all', { each: true }) assigneeIds: string[];
  @ApiProperty({ description: '0 for a new route; current version for update' }) @IsInt() @Min(0) version: number;
  @ApiProperty() @IsInt() @Min(1) @Max(90) dueDays: number;
}
export class CreateRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() studentId?: string;
  @ApiProperty({ enum: REQUEST_TYPES }) @IsIn(REQUEST_TYPES) type: RequestType;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(10000) description: string;
  @ApiProperty() @IsUUID() idempotencyKey: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsUUID('all', { each: true }) attachmentIds?: string[];
}
export const REQUEST_ACTIONS = ['submit', 'accept', 'needs_changes', 'revise', 'approve', 'reject', 'withdraw', 'close', 'reassign'] as const;
export class RequestCommandDto {
  @ApiProperty({ enum: REQUEST_ACTIONS }) @IsIn(REQUEST_ACTIONS) action: typeof REQUEST_ACTIONS[number];
  @ApiProperty() @IsUUID() idempotencyKey: string;
  @ApiProperty() @IsInt() @Min(1) version: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(2) sequence?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) @MaxLength(10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) resultReference?: string;
}
export class RequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional({ enum: REQUEST_STATUSES }) @IsOptional() @IsIn(REQUEST_STATUSES) status?: RequestStatus;
  @ApiPropertyOptional({ enum: REQUEST_TYPES }) @IsOptional() @IsIn(REQUEST_TYPES) type?: RequestType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() groupId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() facultyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsIn([0, 1]) overdue?: number;
}
export class DispatcherQueryDto extends PaginationQueryDto {
  @ApiProperty() @IsUUID() groupId: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
}
