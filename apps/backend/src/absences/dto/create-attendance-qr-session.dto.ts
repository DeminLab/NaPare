import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateAttendanceQrSessionDto {
  @ApiProperty()
  @IsUUID()
  lessonId: string;
}
