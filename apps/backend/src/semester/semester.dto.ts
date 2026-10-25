import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsString, Matches, Max, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

export class MoodleIdentityDto {
  @ApiProperty({ description: 'Verified numeric Moodle user ID, never a name/email or local UUID' })
  @IsString() @Matches(/^[1-9]\d{0,14}$/) externalUserId: string;
  @ApiProperty({ description: 'Administrator has checked the identity in the source register' })
  @IsBoolean() @Equals(true) confirmed: boolean;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
export class SemesterQueryDto extends PaginationQueryDto {
  @Max(10) limit = 10;
  @ApiProperty({ example: '2026-autumn' })
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,80}$/) period: string;
}
