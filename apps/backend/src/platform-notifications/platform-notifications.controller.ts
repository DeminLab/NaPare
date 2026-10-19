import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformDeviceTokenQueryDto, PlatformNotificationKind, PlatformNotificationPatchDto, PlatformNotificationQueryDto, PlatformReasonDto } from './platform-notifications.dto';
import { PlatformNotificationsService } from './platform-notifications.service';

@ApiTags('platform-notifications') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('platform-notifications')
export class PlatformNotificationsController {
  constructor(private readonly notifications: PlatformNotificationsService) {}

  @Get('records') @ApiOperation({ summary: 'Поиск доставленных уведомлений и inbox-записей пользователей' })
  records(@Query() query: PlatformNotificationQueryDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.notifications.records(query, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Get('records/:kind/:id') @ApiOperation({ summary: 'Просмотр полного содержимого уведомления или inbox-записи' })
  record(@Param('kind') kind: PlatformNotificationKind, @Param('id', ParseUUIDPipe) id: string, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.notifications.record(kind, id, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Patch('records/:kind/:id') @ApiOperation({ summary: 'Исправление уведомления или inbox-записи с обязательной причиной' })
  patch(@Param('kind') kind: PlatformNotificationKind, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformNotificationPatchDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.notifications.patch(kind, id, dto, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Get('devices') @ApiOperation({ summary: 'Список push-устройств без раскрытия токенов' })
  devices(@Query() query: PlatformDeviceTokenQueryDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.notifications.devices(query, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Patch('devices/:id/revoke') @ApiOperation({ summary: 'Обратимый отзыв push-токена устройства с причиной' })
  revokeDevice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformReasonDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.notifications.revokeDevice(id, dto.reason, { ip: req.ip, userAgent: req.get('user-agent') });
  }
}
