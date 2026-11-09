import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  AnalyticsOverviewQueryDto,
  MonitoredUserQueryDto,
  RevokeSessionDto,
  SessionQueryDto,
  TelemetryEventQueryDto,
} from './platform-analytics.dto';
import { PlatformAnalyticsService } from './platform-analytics.service';

type AuditRequest = { ip?: string; get(name: string): string | undefined };

@ApiTags('platform-analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform')
export class PlatformAnalyticsController {
  constructor(private readonly analytics: PlatformAnalyticsService) {}

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Реальные агрегаты платформы за выбранный период' })
  overview(@Query() query: AnalyticsOverviewQueryDto) {
    return this.analytics.overview(query);
  }

  @Get('events')
  @ApiOperation({ summary: 'Журнал технических событий с фильтрами и поиском' })
  events(@Query() query: TelemetryEventQueryDto) {
    return this.analytics.events(query);
  }

  @Get('events/facets')
  @ApiOperation({ summary: 'Значения фильтров журнала событий за период' })
  eventFacets(@Query() query: TelemetryEventQueryDto) {
    return this.analytics.eventFacets(query);
  }

  @Get('monitored-users')
  @ApiOperation({ summary: 'Пользователи с последней активностью и сессиями' })
  users(@Query() query: MonitoredUserQueryDto) {
    return this.analytics.users(query);
  }

  @Get('monitored-users/:id/activity')
  @ApiOperation({ summary: 'Карточка пользователя: сессии, входы, события и аудит' })
  userActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.analytics.userActivity(id);
  }

  @Post('monitored-users/:id/revoke-sessions')
  @ApiOperation({ summary: 'Принудительно завершить все сессии пользователя' })
  revokeUserSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeSessionDto,
    @Request() req: AuditRequest,
  ) {
    return this.analytics.revokeUserSessions(id, dto.reason, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Активные и завершённые сессии устройств' })
  sessions(@Query() query: SessionQueryDto) {
    return this.analytics.sessions(query);
  }

  @Post('sessions/:id/revoke')
  @ApiOperation({ summary: 'Завершить конкретную сессию' })
  revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeSessionDto,
    @Request() req: AuditRequest,
  ) {
    return this.analytics.revokeSession(id, dto.reason, { ip: req.ip, userAgent: req.get('user-agent') });
  }
}
