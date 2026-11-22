import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class MaxAuthDto {
  @ApiProperty({
    description: 'Строка window.WebApp.initData из MAX Bridge',
    example: 'auth_date=1758700000&user=%7B%22id%22%3A424242%7D&hash=…',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  initData: string;

  @ApiPropertyOptional({ description: 'Логин NaPare для первой привязки аккаунта' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username?: string;

  @ApiPropertyOptional({ description: 'Пароль NaPare для первой привязки аккаунта' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password?: string;
}
