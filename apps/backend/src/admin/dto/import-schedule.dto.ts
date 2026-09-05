import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportScheduleDto {
  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiProperty({ enum: ['excel', 'sibit'] })
  @IsEnum(['excel', 'sibit'])
  format: string;
}
