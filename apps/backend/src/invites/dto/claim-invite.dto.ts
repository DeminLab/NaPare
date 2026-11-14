import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data entered by the student at claim time: the full name and the second
 * factor value. Both are verified against the invite; the response stays a
 * uniform 404 when either mismatches (SEC-09).
 */
export class ClaimInviteDto {
  @ApiProperty({ description: 'ФИО, введённое студентом' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName: string;

  @ApiProperty({ description: 'Значение второго фактора приглашения' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  factorValue: string;
}
