import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectAbsenceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  reason: string;
}
