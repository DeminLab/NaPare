import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ writeOnly: true, description: 'Текущий пароль; не записывается в журнал' })
  @IsString() @MinLength(1) @MaxLength(256)
  currentPassword: string;

  @ApiProperty({ enum: [true], description: 'Подтверждение удаления доступа и личного профиля' })
  @Equals(true)
  confirmed: true;

  @ApiProperty({ enum: [true], description: 'Учебный архив и перечисленные исключения прочитаны' })
  @Equals(true)
  acknowledgeRetention: true;
}
