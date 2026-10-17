import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformDiscussionModerationDto, PlatformDiscussionPatchDto, PlatformDiscussionQueryDto } from './platform-discussions.dto';
import { PlatformDiscussionsService } from './platform-discussions.service';

@ApiTags('platform-discussions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-discussions')
export class PlatformDiscussionsController {
  constructor(private readonly discussions: PlatformDiscussionsService) {}

  @Get('messages')
  @ApiOperation({ summary: 'Глобальный поиск сообщений обсуждений с аудитом' })
  messages(@Query() query: PlatformDiscussionQueryDto, @Req() request: Request) {
    return this.discussions.messages(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('messages/:id')
  @ApiOperation({ summary: 'Просмотреть сообщение обсуждения с аудитом' })
  message(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.discussions.message(id, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Исправить текст сообщения обсуждения' })
  patchMessage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformDiscussionPatchDto, @Req() request: Request) {
    return this.discussions.patchMessage(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Post('messages/:id/moderation')
  @ApiOperation({ summary: 'Скрыть или восстановить сообщение обсуждения' })
  moderateMessage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformDiscussionModerationDto, @Req() request: Request) {
    return this.discussions.moderateMessage(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }
}
