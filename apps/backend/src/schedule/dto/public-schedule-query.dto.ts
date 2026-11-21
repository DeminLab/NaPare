import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID, Matches } from 'class-validator';

export class PublicScheduleLessonsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId: string;

  @ApiProperty({ example: '2026-09-14' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from: string;

  @ApiProperty({ example: '2026-09-20' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to: string;
}
