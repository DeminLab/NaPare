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
  users(@Query() query: PlatformPersonalRecordsQueryDto, @Req() request: Request) {
    return this.records.users(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Карточка личных записей пользователя с аудитом просмотра' })
  userRecords(@Param('userId', ParseUUIDPipe) userId: string, @Req() request: Request) {
    return this.records.userRecords(userId, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Put('users/:userId/preferences')
  @ApiOperation({ summary: 'Создать или заменить набор предпочтений уведомлений пользователя' })
  putPreferences(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: PlatformNotificationPreferencesDto, @Req() request: Request) {
    return this.records.putPreferences(userId, dto, this.auditContext(request));
  }

  @Patch('users/:userId/preferences/:id')
  @ApiOperation({ summary: 'Изменить предпочтения уведомлений пользователя' })
  patchPreferences(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformNotificationPreferencesPatchDto, @Req() request: Request) {
    return this.records.patchPreferences(userId, id, dto, this.auditContext(request));
  }

  @Delete('users/:userId/preferences/:id')
  @ApiOperation({ summary: 'Сбросить предпочтения уведомлений пользователя к значениям по умолчанию' })
  deletePreferences(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalRecordDeleteDto, @Req() request: Request) {
    return this.records.deletePreferences(userId, id, dto, this.auditContext(request));
  }

  @Put('users/:userId/favorites')
  @ApiOperation({ summary: 'Создать или обновить избранную группу или преподавателя' })
  putFavorite(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: PlatformFavoriteDto, @Req() request: Request) {
    return this.records.putFavorite(userId, dto, this.auditContext(request));
  }

  @Patch('users/:userId/favorites/:id')
  @ApiOperation({ summary: 'Изменить избранную группу или преподавателя пользователя' })
  patchFavorite(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformFavoritePatchDto, @Req() request: Request) {
    return this.records.patchFavorite(userId, id, dto, this.auditContext(request));
  }

  @Delete('users/:userId/favorites/:id')
  @ApiOperation({ summary: 'Удалить элемент из избранного пользователя' })
  deleteFavorite(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalRecordDeleteDto, @Req() request: Request) {
    return this.records.deleteFavorite(userId, id, dto, this.auditContext(request));
  }

  @Put('users/:userId/lesson-notes/:pairSpaceId')
  @ApiOperation({ summary: 'Создать или заменить личную заметку пользователя к занятию' })
  putLessonNote(@Param('userId', ParseUUIDPipe) userId: string, @Param('pairSpaceId', ParseUUIDPipe) pairSpaceId: string, @Body() dto: PlatformPersonalLessonNoteDto, @Req() request: Request) {
    return this.records.putLessonNote(userId, pairSpaceId, dto, this.auditContext(request));
  }

  @Patch('users/:userId/lesson-notes/:id')
  @ApiOperation({ summary: 'Изменить личную заметку пользователя' })
  patchLessonNote(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalLessonNotePatchDto, @Req() request: Request) {
    return this.records.patchLessonNote(userId, id, dto, this.auditContext(request));
  }

  @Delete('users/:userId/lesson-notes/:id')
  @ApiOperation({ summary: 'Удалить личную заметку пользователя' })
  deleteLessonNote(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalRecordDeleteDto, @Req() request: Request) {
    return this.records.deleteLessonNote(userId, id, dto, this.auditContext(request));
  }

  @Put('users/:userId/homework-progress/:homeworkId')
  @ApiOperation({ summary: 'Создать или заменить личный прогресс студента по подготовке' })
  putHomeworkProgress(@Param('userId', ParseUUIDPipe) userId: string, @Param('homeworkId', ParseUUIDPipe) homeworkId: string, @Body() dto: PlatformHomeworkProgressDto, @Req() request: Request) {
    return this.records.putHomeworkProgress(userId, homeworkId, dto, this.auditContext(request));
  }

  @Patch('users/:userId/homework-progress/:id')
  @ApiOperation({ summary: 'Изменить личный прогресс студента по подготовке' })
  patchHomeworkProgress(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformHomeworkProgressPatchDto, @Req() request: Request) {
    return this.records.patchHomeworkProgress(userId, id, dto, this.auditContext(request));
  }

  @Delete('users/:userId/homework-progress/:id')
  @ApiOperation({ summary: 'Удалить личный прогресс студента по подготовке' })
  deleteHomeworkProgress(@Param('userId', ParseUUIDPipe) userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPersonalRecordDeleteDto, @Req() request: Request) {
    return this.records.deleteHomeworkProgress(userId, id, dto, this.auditContext(request));
  }

  private auditContext(request: Request) { return { ip: request.ip, userAgent: request.get('user-agent') }; }
}
