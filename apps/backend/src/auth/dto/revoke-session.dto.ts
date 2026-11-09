import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeOwnSessionDto {
  @ApiPropertyOptional({ description: 'Комментарий для истории сессий' })
  @IsOptional() @IsString() @MaxLength(200)
  reason?: string;
}

