import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UserRole } from '../auth/interfaces/user-role';
import { FAVORITE_KINDS, FavoriteKind } from '../favorites/entities/favorite.entity';
import { HOMEWORK_PROGRESS_STATES, HomeworkProgressState, HomeworkProgressSubtask } from '../pair-space/entities/homework-progress.entity';

export class PlatformPersonalRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID()
  universityId?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional() @IsIn(Object.values(UserRole))
  role?: UserRole;
}

export class PlatformPersonalRecordReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString() @MinLength(3) @MaxLength(500) @Matches(/\S/)
  reason: string;
}

export class PlatformNotificationPreferencesDto extends PlatformPersonalRecordReasonDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  universityId: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() scheduleChanges?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cancellations?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() roomChanges?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() homeworkCreated?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() deadlines?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() messages?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() announcements?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() systemAlerts?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() telegramEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() quietHoursEnabled?: boolean;
  @ApiPropertyOptional({ example: '22:00', nullable: true })
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursStart?: string | null;
  @ApiPropertyOptional({ example: '07:00', nullable: true })
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursEnd?: string | null;
  @ApiPropertyOptional({ example: 'Asia/Omsk', maxLength: 64 })
  @IsOptional() @IsString() @MaxLength(64) timeZone?: string;
}

export class PlatformNotificationPreferencesPatchDto extends PlatformPersonalRecordReasonDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() scheduleChanges?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cancellations?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() roomChanges?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() homeworkCreated?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() deadlines?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() messages?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() announcements?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() systemAlerts?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() telegramEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() quietHoursEnabled?: boolean;
  @ApiPropertyOptional({ example: '22:00', nullable: true }) @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursStart?: string | null;
  @ApiPropertyOptional({ example: '07:00', nullable: true }) @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursEnd?: string | null;
  @ApiPropertyOptional({ example: 'Asia/Omsk', maxLength: 64 }) @IsOptional() @IsString() @MaxLength(64) timeZone?: string;
}

export class PlatformFavoriteDto extends PlatformPersonalRecordReasonDto {
  @ApiProperty({ enum: FAVORITE_KINDS })
  @IsIn(FAVORITE_KINDS)
  kind: FavoriteKind;

  @ApiProperty({ maxLength: 220 })
  @IsString() @MinLength(1) @MaxLength(220) @Matches(/\S/)
  externalId: string;

  @ApiProperty({ maxLength: 220 })
  @IsString() @MinLength(1) @MaxLength(220) @Matches(/\S/)
  label: string;
}

export class PlatformFavoritePatchDto extends PlatformPersonalRecordReasonDto {
  @ApiPropertyOptional({ enum: FAVORITE_KINDS }) @IsOptional() @IsIn(FAVORITE_KINDS) kind?: FavoriteKind;
  @ApiPropertyOptional({ maxLength: 220 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(220) @Matches(/\S/) externalId?: string;
  @ApiPropertyOptional({ maxLength: 220 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(220) @Matches(/\S/) label?: string;
}

export class PlatformPersonalLessonNoteDto extends PlatformPersonalRecordReasonDto {
  @ApiProperty({ maxLength: 20000 })
  @IsString() @MinLength(1) @MaxLength(20000) @Matches(/\S/)
  content: string;
}

export class PlatformPersonalLessonNotePatchDto extends PlatformPersonalRecordReasonDto {
  @ApiProperty({ maxLength: 20000 }) @IsString() @MinLength(1) @MaxLength(20000) @Matches(/\S/) content: string;
}

export class PlatformHomeworkProgressSubtaskDto implements HomeworkProgressSubtask {
  @ApiProperty({ format: 'uuid' }) @IsUUID()
  id: string;

  @ApiProperty({ maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) @Matches(/\S/)
  title: string;

  @ApiProperty() @IsBoolean()
  done: boolean;
}

export class PlatformHomeworkProgressDto extends PlatformPersonalRecordReasonDto {
  @ApiProperty({ enum: HOMEWORK_PROGRESS_STATES }) @IsIn(HOMEWORK_PROGRESS_STATES)
  state: HomeworkProgressState;

  @ApiProperty({ type: [PlatformHomeworkProgressSubtaskDto], maxItems: 20 })
  @IsArray() @ArrayMaxSize(20) @ArrayUnique(item => item.id) @ValidateNested({ each: true }) @Type(() => PlatformHomeworkProgressSubtaskDto)
  subtasks: PlatformHomeworkProgressSubtaskDto[];
}

export class PlatformHomeworkProgressPatchDto extends PlatformPersonalRecordReasonDto {
  @ApiPropertyOptional({ enum: HOMEWORK_PROGRESS_STATES }) @IsOptional() @IsIn(HOMEWORK_PROGRESS_STATES) state?: HomeworkProgressState;
  @ApiPropertyOptional({ type: [PlatformHomeworkProgressSubtaskDto], maxItems: 20 })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique(item => item.id) @ValidateNested({ each: true }) @Type(() => PlatformHomeworkProgressSubtaskDto)
  subtasks?: PlatformHomeworkProgressSubtaskDto[];
}

export class PlatformPersonalRecordDeleteDto extends PlatformPersonalRecordReasonDto {}
