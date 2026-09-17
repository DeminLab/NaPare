import { IsEmail, IsString, MinLength, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Иван' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Иванов' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'uuid-of-university' })
  @IsUUID()
  universityId: string;

  @ApiProperty({ example: '12131', required: false })
  @IsOptional()
  @IsString()
  groupId?: string;
}
