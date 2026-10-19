import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformPairSpaceAnnouncementPatchDto, PlatformPairSpaceAnnouncementQueryDto, PlatformPairSpacePatchDto, PlatformPairSpaceQueryDto } from './platform-pair-space.dto';
import { PlatformPairSpaceService } from './platform-pair-space.service';

@ApiTags('platform-pair-space')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-pair-space')
export class PlatformPairSpaceController {
  constructor(private readonly pairSpace: PlatformPairSpaceService) {}

  @Get('spaces')
  @ApiOperation({ summary: 'Глобальный поиск и проверка связей пространств пар' })
  spaces(@Query() query: PlatformPairSpaceQueryDto, @Req() request: Request) {
    return this.pairSpace.spaces(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('spaces/:id')
  @ApiOperation({ summary: 'Просмотреть пространство пары и связанные академические записи с аудитом' })
  space(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.pairSpace.space(id, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Patch('spaces/:id')
  @ApiOperation({ summary: 'Изменить активность пространства пары с обязательной причиной' })
  patchSpace(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPairSpacePatchDto, @Req() request: Request) {
    return this.pairSpace.patchSpace(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Глобальный поиск объявлений PairSpace' })
  announcements(@Query() query: PlatformPairSpaceAnnouncementQueryDto, @Req() request: Request) {
    return this.pairSpace.announcements(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('announcements/:id')
  @ApiOperation({ summary: 'Просмотреть объявление PairSpace с аудитом' })
  announcement(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.pairSpace.announcement(id, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Patch('announcements/:id')
  @ApiOperation({ summary: 'Исправить текст или закрепление объявления с обязательной причиной' })
  patchAnnouncement(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPairSpaceAnnouncementPatchDto, @Req() request: Request) {
    return this.pairSpace.patchAnnouncement(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }
}
