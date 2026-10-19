import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAcademicEventPatchDto, PlatformAcademicEventReasonDto, PlatformAcademicEventsQueryDto } from './platform-academic-events.dto';
import { PlatformAcademicEventsService } from './platform-academic-events.service';

@ApiTags('platform-academic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-academic/events')
export class PlatformAcademicEventsController {
  constructor(private readonly service: PlatformAcademicEventsService) {}

  @Get()
  @ApiOperation({ summary: 'Глобальный поиск доменных академических событий' })
  list(@Query() query: PlatformAcademicEventsQueryDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.list(query, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.detail(id, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Исправить самостоятельное доменное академическое событие с обязательной причиной' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAcademicEventPatchDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.update(id, dto, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Post(':id/hide')
  @ApiOperation({ summary: 'Обратимо скрыть событие из обычной академической ленты' })
  hide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAcademicEventReasonDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.setHidden(id, dto, true, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Вернуть скрытое событие в академическую ленту' })
  restore(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAcademicEventReasonDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.setHidden(id, dto, false, { ip: req.ip, userAgent: req.get('user-agent') });
  }
}
