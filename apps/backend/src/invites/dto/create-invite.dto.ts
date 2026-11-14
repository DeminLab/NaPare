import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { INVITE_FACTOR_TYPES, InviteFactorType } from '../invites.constants';

/** Staff-approved second factor set; weak factors are never used alone (FR-ONB-03). */
export class CreateInviteDto {
  @ApiProperty({ description: 'Email существующего студента организации' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Группа; по умолчанию группа студента' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiProperty({ enum: INVITE_FACTOR_TYPES, description: 'Тип второго фактора из утверждённого набора' })
  @IsIn(INVITE_FACTOR_TYPES)
  factorType: InviteFactorType;

  @ApiProperty({ description: 'Значение второго фактора; хранится только bcrypt-хэш' })
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  factorValue: string;
}
