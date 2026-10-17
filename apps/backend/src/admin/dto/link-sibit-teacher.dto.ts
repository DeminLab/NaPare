import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LinkSibitTeacherDto {
  @ApiPropertyOptional({ example: '20', nullable: true, description: 'Внешний ID преподавателя из расписания СИБИТа; null снимает привязку' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  sourceTeacherId?: string | null;
}
