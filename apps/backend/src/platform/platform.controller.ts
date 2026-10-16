import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformService } from './platform.service';
import { PlatformAccountDto, PlatformCreateAccountDto, PlatformEmergencyDto, PlatformGrantDto, PlatformJobDto, PlatformPasswordDto, PlatformQueryDto, PlatformSettingsDto, PlatformUniversityDto } from './platform.dto';

@ApiTags('platform') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}
  @Get('access') @ApiOperation({ summary: 'Владелец и действующие отдельные разрешения' }) access() { return this.platform.access(); }
  @Get('services') @ApiOperation({ summary: 'Состояние разрешённых сервисов и сервера' }) services() { return this.platform.services(); }
  @Get('services/:service/logs') logs(@Param('service') service: string) { return this.platform.logs(service); }
  @Get('jobs') jobs() { return this.platform.jobs(); }
  @Get('jobs/:id') job(@Param('id', ParseUUIDPipe) id: string) { return this.platform.job(id); }
  @Post('jobs') @ApiOperation({ summary: 'Поставить рестарт или ребилд одного сервиса в очередь' }) start(@Body() dto: PlatformJobDto) { return this.platform.startJob(dto); }
  @Get('accounts') accounts(@Query() query: PlatformQueryDto) { return this.platform.accounts(query); }
  @Post('accounts') create(@Body() dto: PlatformCreateAccountDto) { return this.platform.createAccount(dto); }
  @Patch('accounts/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAccountDto) { return this.platform.updateAccount(id, dto); }
  @Post('accounts/:id/password') password(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPasswordDto) { return this.platform.resetPassword(id, dto.password); }
  @Post('accounts/:id/revoke-sessions') revoke(@Param('id', ParseUUIDPipe) id: string) { return this.platform.revokeSessions(id); }
  @Get('permissions') grants(@Query() query: PlatformQueryDto) { return this.platform.grants(query); }
  @Put('permissions/:id') grant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformGrantDto) { return this.platform.setGrant(id, dto); }
  @Post('trust/emergency-revoke') @ApiOperation({ summary: 'Только владелец: отозвать весь делегированный техдоступ и сессии' }) emergency(@Body() dto: PlatformEmergencyDto) { return this.platform.emergencyRevoke(dto.password); }
  @Get('settings') settings() { return this.platform.settings(); }
  @Put('settings') updateSettings(@Body() dto: PlatformSettingsDto) { return this.platform.updateSettings(dto); }
  @Get('universities') universities(@Query() query: PlatformQueryDto) { return this.platform.universities(query); }
  @Post('universities') createUniversity(@Body() dto: PlatformUniversityDto) { return this.platform.saveUniversity(dto); }
  @Put('universities/:id') updateUniversity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformUniversityDto) { return this.platform.saveUniversity(dto, id); }
  @Get('audit') audit(@Query() query: PlatformQueryDto) { return this.platform.auditLog(query); }
}
@ApiTags('platform') @Controller('platform')
export class PlatformPublicController {
  constructor(private readonly platform: PlatformService) {}
  @Get('public-settings') @ApiOperation({ summary: 'Публичное название, поддержка, объявление и режим обслуживания' }) settings() { return this.platform.settings(true); }
}
