import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class MaxAuthDto {
  @ApiProperty({
    description: 'Строка window.WebApp.initData из MAX Bridge',
    example: 'auth_date=1758700000&user=%7B%22id%22%3A424242%7D&hash=…',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  initData: string;

  @ApiPropertyOptional({ description: 'Email NaPare для первой привязки аккаунта' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Пароль NaPare для первой привязки аккаунта' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password?: string;
}
