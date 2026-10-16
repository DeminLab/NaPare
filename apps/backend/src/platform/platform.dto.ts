import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserRole } from '../auth/interfaces/user-role';

export const PLATFORM_PERMISSIONS = ['services.read', 'services.restart', 'services.rebuild', 'logs.read', 'accounts.read', 'accounts.write', 'universities.read', 'universities.write', 'settings.read', 'settings.write', 'audit.read'] as const;
export type PlatformPermission = typeof PLATFORM_PERMISSIONS[number];
export const SERVICE_IDS = ['backend', 'web-portal', 'web-student', 'web-staff', 'web-admin', 'web-developer', 'nginx', 'postgres', 'redis'] as const;
export class PlatformQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
}
export class PlatformGrantDto {
  @ApiProperty({ enum: PLATFORM_PERMISSIONS, isArray: true }) @IsArray() @ArrayUnique() @IsIn(PLATFORM_PERMISSIONS, { each: true }) permissions: PlatformPermission[];
  @ApiProperty({ enum: SERVICE_IDS, isArray: true }) @IsArray() @ArrayUnique() @IsIn(SERVICE_IDS, { each: true }) serviceIds: string[];
}
export class PlatformJobDto {
  @ApiProperty({ enum: SERVICE_IDS }) @IsIn(SERVICE_IDS) service: string;
  @ApiProperty({ enum: ['restart', 'rebuild'] }) @IsIn(['restart', 'rebuild']) action: 'restart' | 'rebuild';
  @ApiProperty() @IsString() confirm: string;
  @ApiProperty() @IsUUID() idempotencyKey: string;
}
export class PlatformAccountDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(100) lastName?: string;
  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class PlatformCreateAccountDto extends PlatformAccountDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(72) password: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() universityId?: string;
}
export class PlatformPasswordDto {
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(72) password: string;
}
export class PlatformEmergencyDto {
  @ApiProperty() @IsString() @IsIn(['ОТОЗВАТЬ ТЕХДОСТУП']) confirm: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(72) password: string;
}
export class PlatformSettingsDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) platformName: string;
  @ApiProperty() @IsString() @MaxLength(254) supportEmail: string;
  @ApiProperty() @IsString() @MaxLength(2000) announcement: string;
  @ApiProperty() @IsBoolean() readOnly: boolean;
}
export class PlatformUniversityDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) city: string;
  @ApiProperty({ enum: ['active','inactive','pending'] }) @IsIn(['active','inactive','pending']) status: string;
}
