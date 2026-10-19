import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAttendanceQrQueryDto, RevokeAttendanceQrDto } from './platform-attendance-qr.dto';
import { PlatformAttendanceQrService } from './platform-attendance-qr.service';

@ApiTags('platform-attendance-qr') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('platform-attendance-qr')
export class PlatformAttendanceQrController {
  constructor(private readonly sessions: PlatformAttendanceQrService) {}
  @Get('sessions') @ApiOperation({ summary: 'Поиск QR-сессий отметки посещаемости без раскрытия секрета' }) list(@Query() query: PlatformAttendanceQrQueryDto, @Req() req: Request) { return this.sessions.list(query, this.context(req)); }
  @Patch('sessions/:id/revoke') @ApiOperation({ summary: 'Отозвать QR-сессию отметки посещаемости' }) revoke(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RevokeAttendanceQrDto, @Req() req: Request) { return this.sessions.revoke(id, dto, this.context(req)); }
  private context(request: Request) { return { ip: request.ip, userAgent: request.get('user-agent') }; }
}
