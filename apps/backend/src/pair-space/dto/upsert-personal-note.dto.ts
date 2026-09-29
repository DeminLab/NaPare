import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpsertPersonalNoteDto {
  @ApiProperty({ maxLength: 20000, description: 'Личная заметка к занятию; пустая строка удаляет её содержимое.' })
  @IsString()
  @MaxLength(20000)
  content: string;
}
