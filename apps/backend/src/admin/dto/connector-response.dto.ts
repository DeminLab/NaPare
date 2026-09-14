import { ApiProperty } from '@nestjs/swagger';

export class ConnectorResponseDto {
  @ApiProperty({ example: 'sibit' })
  id: string;

  @ApiProperty({ example: 'SIBIT' })
  name: string;

  @ApiProperty({ example: 'api' })
  type: string;

  @ApiProperty({ example: 'active' })
  status: string;
}
