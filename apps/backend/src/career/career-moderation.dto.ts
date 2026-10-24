import { ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CareerTaskDto } from './career.dto';

export class CareerTaskRevisionDto extends PickType(CareerTaskDto, ['title','description','criteria','requirements','rewardKopecks','hours','deadline','profiled','skill','level'] as const) {
  @ApiProperty() @IsInt() @Min(1) expectedVersion: number;
}
export class CareerModerationDecisionDto {
  @ApiProperty() @IsIn(['approve','reject']) decision: 'approve' | 'reject';
  @ApiProperty() @IsInt() @Min(1) expectedVersion: number;
  @ApiProperty({required:false}) @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
export class CareerComplaintDto {
  @ApiProperty() @IsIn(['prepayment','misleading','unsafe','other']) category: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(4000) details: string;
}
export class CareerComplaintDecisionDto {
  @ApiProperty() @IsIn(['uphold','dismiss']) decision: 'uphold' | 'dismiss';
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(2000) reason: string;
}
export class CareerModerationPageDto {
  @ApiProperty({required:false}) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
  @ApiProperty({required:false}) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
export class CareerMyComplaintPageDto extends CareerModerationPageDto {
  @ApiProperty({required:false}) @IsOptional() @IsUUID() taskId?: string;
}
