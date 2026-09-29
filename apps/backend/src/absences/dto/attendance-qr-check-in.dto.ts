import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class AttendanceQrCheckInDto {
  @ApiProperty({ description: 'Короткоживущий случайный токен QR-сессии' })
  @IsString()
  @Length(40, 64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token: string;
}
