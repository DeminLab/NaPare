import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFileDto {
  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsEnum(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'png'])
  fileType: string;

  @ApiProperty()
  @IsNumber()
  size: number;
}
