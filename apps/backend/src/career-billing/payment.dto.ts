import { IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() companyId: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() idempotencyKey: string;
  @ApiProperty({ enum: ['career_access'] }) @IsIn(['career_access']) product: 'career_access';
}
export class RefundPaymentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() idempotencyKey: string;
  @ApiProperty({ minimum: 1, maximum: 999999999, description: 'Сумма возврата в целых копейках' }) @IsInt() @Min(1) @Max(999999999) amountMinor: number;
  @ApiProperty({ minLength: 3, maxLength: 500 }) @IsString() @MinLength(3) @MaxLength(500) reason: string;
}
