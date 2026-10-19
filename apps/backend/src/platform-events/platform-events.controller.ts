import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformEventsQueryDto } from './platform-events.dto';
import { PlatformEventsService } from './platform-events.service';

@ApiTags('platform-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-events')
export class PlatformEventsController {
  constructor(private readonly events: PlatformEventsService) {}

  @Get()
  @ApiOperation({ summary: 'Глобальный поиск системных событий с очищенным payload' })
  list(@Query() query: PlatformEventsQueryDto, @Req() request: Request) {
    return this.events.list(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Просмотр системного события без служебных ключей и адресатов' })
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.events.detail(id, { ip: request.ip, userAgent: request.get('user-agent') });
  }
}
