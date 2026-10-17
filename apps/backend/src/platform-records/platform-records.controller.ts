import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  PlatformFavoriteDto,
  PlatformFavoritePatchDto,
  PlatformHomeworkProgressDto,
  PlatformHomeworkProgressPatchDto,
  PlatformNotificationPreferencesDto,
  PlatformNotificationPreferencesPatchDto,
  PlatformPersonalLessonNoteDto,
  PlatformPersonalLessonNotePatchDto,
  PlatformPersonalRecordDeleteDto,
  PlatformPersonalRecordsQueryDto,
} from './platform-records.dto';
import { PlatformRecordsService } from './platform-records.service';

@ApiTags('platform-records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-records')
export class PlatformRecordsController {
  constructor(private readonly records: PlatformRecordsService) {}

  @Get('users')
  @ApiOperation({ summary: 'Глобальный поиск пользователей для просмотра личных записей' })
  users(@Query() query: PlatformPersonalRecordsQueryDto) {
    return this.records.users(query);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Карточка личных записей пользователя с аудитом просмотра' })
  userRecords(@Param('userId', ParseUUIDPipe) userId: string, @Req() request: Request) {
    return this.records.userRecords(userId, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Put('users/:userId/preferences')
  @ApiOperation({ summary: 'Создать или заменить набор предпочтений уведомлений пользователя' })
  putPreferences(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: PlatformNotificationPreferencesDto) {
    return this.records.putPreferences(userId, dto);
  }

  @Patch('users/:userId/preferences/:id')
  @ApiOperation({ summary: 'Изменить предпочтения уведомлений пользователя' })
  patchPreferences(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformNotificationPreferencesPatchDto) {
    return this.records.patchPreferences(userId, id, dto);
  }

  @Delete('users/:userId/preferences/:id')
  @ApiOperation({ summary: 'Сбросить предпочтения уведомлений пользователя к значениям по умолчанию' })
  deletePreferences(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalRecordDeleteDto) {
    return this.records.deletePreferences(userId, id, dto);
  }

  @Put('users/:userId/favorites')
  @ApiOperation({ summary: 'Создать или обновить избранную группу или преподавателя' })
  putFavorite(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: PlatformFavoriteDto) {
    return this.records.putFavorite(userId, dto);
  }

  @Patch('users/:userId/favorites/:id')
  @ApiOperation({ summary: 'Изменить избранную группу или преподавателя пользователя' })
  patchFavorite(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformFavoritePatchDto) {
    return this.records.patchFavorite(userId, id, dto);
  }

  @Delete('users/:userId/favorites/:id')
  @ApiOperation({ summary: 'Удалить элемент из избранного пользователя' })
  deleteFavorite(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalRecordDeleteDto) {
    return this.records.deleteFavorite(userId, id, dto);
  }

  @Put('users/:userId/lesson-notes/:pairSpaceId')
  @ApiOperation({ summary: 'Создать или заменить личную заметку пользователя к занятию' })
  putLessonNote(@Param('userId', ParseUUIDPipe) userId: string, @Param('pairSpaceId', ParseUUIDPipe) pairSpaceId: string, @Body() dto: PlatformPersonalLessonNoteDto) {
    return this.records.putLessonNote(userId, pairSpaceId, dto);
  }

  @Patch('users/:userId/lesson-notes/:id')
  @ApiOperation({ summary: 'Изменить личную заметку пользователя' })
  patchLessonNote(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalLessonNotePatchDto) {
    return this.records.patchLessonNote(userId, id, dto);
  }

  @Delete('users/:userId/lesson-notes/:id')
  @ApiOperation({ summary: 'Удалить личную заметку пользователя' })
  deleteLessonNote(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalRecordDeleteDto) {
    return this.records.deleteLessonNote(userId, id, dto);
  }

  @Put('users/:userId/homework-progress/:homeworkId')
  @ApiOperation({ summary: 'Создать или заменить личный прогресс студента по подготовке' })
  putHomeworkProgress(@Param('userId', ParseUUIDPipe) userId: string, @Param('homeworkId', ParseUUIDPipe) homeworkId: string, @Body() dto: PlatformHomeworkProgressDto) {
    return this.records.putHomeworkProgress(userId, homeworkId, dto);
  }

  @Patch('users/:userId/homework-progress/:id')
  @ApiOperation({ summary: 'Изменить личный прогресс студента по подготовке' })
  patchHomeworkProgress(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformHomeworkProgressPatchDto) {
    return this.records.patchHomeworkProgress(userId, id, dto);
  }

  @Delete('users/:userId/homework-progress/:id')
  @ApiOperation({ summary: 'Удалить личный прогресс студента по подготовке' })
  deleteHomeworkProgress(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalRecordDeleteDto) {
    return this.records.deleteHomeworkProgress(userId, id, dto);
  }
}
