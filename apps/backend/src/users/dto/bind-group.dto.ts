import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BindGroupDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId: string;
}
