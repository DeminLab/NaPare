import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { HOMEWORK_PROGRESS_STATES, HomeworkProgressState, HomeworkProgressSubtask } from '../entities/homework-progress.entity';

export class HomeworkProgressSubtaskDto implements HomeworkProgressSubtask {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/\S/)
  title: string;

  @ApiProperty()
  @IsBoolean()
  done: boolean;
}

export class UpdateHomeworkProgressDto {
  @ApiProperty({ enum: HOMEWORK_PROGRESS_STATES, required: false, description: 'Личный статус подготовки; не является отметкой о сдаче в LMS' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(HOMEWORK_PROGRESS_STATES)
  state?: HomeworkProgressState;

  @ApiProperty({ type: [HomeworkProgressSubtaskDto], required: false, maxItems: 20 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HomeworkProgressSubtaskDto)
  subtasks?: HomeworkProgressSubtaskDto[];
}
