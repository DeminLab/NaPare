import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformService } from './platform.service';
import { PlatformAccountDto, PlatformCreateAccountDto, PlatformEmergencyDto, PlatformFacultyDto, PlatformGrantDto, PlatformGroupDto, PlatformIdentityLinkDto, PlatformJobDto, PlatformPasswordDto, PlatformQueryDto, PlatformSettingsDto, PlatformUniversityDto } from './platform.dto';

@ApiTags('platform') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}
  @Get('access') @ApiOperation({ summary: 'Владелец и действующие отдельные разрешения' }) access() { return this.platform.access(); }
  @Get('services') @ApiOperation({ summary: 'Состояние разрешённых сервисов и сервера' }) services() { return this.platform.services(); }
  @Get('services/:service/logs') logs(@Param('service') service: string) { return this.platform.logs(service); }
  @Get('jobs') jobs() { return this.platform.jobs(); }
  @Get('jobs/:id') job(@Param('id', ParseUUIDPipe) id: string) { return this.platform.job(id); }
  @Post('jobs') @ApiOperation({ summary: 'Поставить рестарт или ребилд одного сервиса в очередь' }) start(@Body() dto: PlatformJobDto) { return this.platform.startJob(dto); }
  @Get('accounts') accounts(@Query() query: PlatformQueryDto, @Request() req: { ip: string; get(name: string): string | undefined }) { return this.platform.accounts(query, { ip: req.ip, userAgent: req.get('user-agent') }); }
  @Get('accounts/:id') @ApiOperation({ summary: 'Подробная карточка аккаунта для управления платформой' }) account(@Param('id', ParseUUIDPipe) id: string, @Request() req: { ip: string; get(name: string): string | undefined }) { return this.platform.account(id, { ip: req.ip, userAgent: req.get('user-agent') }); }
  @Post('accounts') create(@Body() dto: PlatformCreateAccountDto, @Request() req: { ip: string; get(name: string): string | undefined }) { return this.platform.createAccount(dto, { ip: req.ip, userAgent: req.get('user-agent') }); }
  @Patch('accounts/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAccountDto, @Request() req: { ip: string; get(name: string): string | undefined }) { return this.platform.updateAccount(id, dto, { ip: req.ip, userAgent: req.get('user-agent') }); }
  @Post('accounts/:id/password') password(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformPasswordDto, @Request() req: { ip: string; get(name: string): string | undefined }) { return this.platform.resetPassword(id, dto.password, { ip: req.ip, userAgent: req.get('user-agent') }); }
  @Post('accounts/:id/identity/max/unlink') @ApiOperation({ summary: 'Отозвать MAX-привязку аккаунта с завершением его сессий' }) unlinkMaxIdentity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformIdentityLinkDto, @Request() req: { ip: string; get(name: string): string | undefined }) { return this.platform.unlinkMaxIdentity(id, dto.reason, { ip: req.ip, userAgent: req.get('user-agent') }); }
  @Post('accounts/:id/identity/telegram/revoke') @ApiOperation({ summary: 'Отозвать Telegram-привязку и ожидающие подключения аккаунта' }) revokeTelegramIdentity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformIdentityLinkDto, @Request() req: { ip: string; get(name: string): string | undefined }) { return this.platform.revokeTelegramIdentity(id, dto.reason, { ip: req.ip, userAgent: req.get('user-agent') }); }
  @Post('accounts/:id/revoke-sessions') revoke(@Param('id', ParseUUIDPipe) id: string, @Request() req: { ip: string; get(name: string): string | undefined }) { return this.platform.revokeSessions(id, { ip: req.ip, userAgent: req.get('user-agent') }); }
  @Get('permissions') grants(@Query() query: PlatformQueryDto) { return this.platform.grants(query); }
  @Put('permissions/:id') grant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformGrantDto) { return this.platform.setGrant(id, dto); }
  @Post('trust/emergency-revoke') @ApiOperation({ summary: 'Только владелец: отозвать весь делегированный техдоступ и сессии' }) emergency(@Body() dto: PlatformEmergencyDto) { return this.platform.emergencyRevoke(dto.password); }
  @Get('settings') settings() { return this.platform.settings(); }
  @Put('settings') updateSettings(@Body() dto: PlatformSettingsDto) { return this.platform.updateSettings(dto); }
  @Get('universities') universities(@Query() query: PlatformQueryDto) { return this.platform.universities(query); }
  @Get('groups') groups(@Query('universityId', ParseUUIDPipe) universityId: string) { return this.platform.groups(universityId); }
  @Post('universities') createUniversity(@Body() dto: PlatformUniversityDto) { return this.platform.saveUniversity(dto); }
  @Put('universities/:id') updateUniversity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformUniversityDto) { return this.platform.saveUniversity(dto, id); }
  @Get('organization/faculties') organizationFaculties(@Query() query: PlatformQueryDto) { return this.platform.organizationFaculties(query); }
  @Post('organization/faculties') createOrganizationFaculty(@Query('universityId', ParseUUIDPipe) universityId: string, @Body() dto: PlatformFacultyDto) { return this.platform.saveOrganizationFaculty(universityId, dto); }
  @Put('organization/faculties/:id') updateOrganizationFaculty(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformFacultyDto) { return this.platform.saveOrganizationFaculty(undefined, dto, id); }
  @Get('organization/groups') organizationGroups(@Query() query: PlatformQueryDto) { return this.platform.organizationGroups(query); }
  @Post('organization/groups') createOrganizationGroup(@Query('universityId', ParseUUIDPipe) universityId: string, @Body() dto: PlatformGroupDto) { return this.platform.saveOrganizationGroup(universityId, dto); }
  @Put('organization/groups/:id') updateOrganizationGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformGroupDto) { return this.platform.saveOrganizationGroup(undefined, dto, id); }
  @Get('audit') audit(@Query() query: PlatformQueryDto) { return this.platform.auditLog(query); }
}
@ApiTags('platform') @Controller('platform')
export class PlatformPublicController {
  constructor(private readonly platform: PlatformService) {}
  @Get('public-settings') @ApiOperation({ summary: 'Публичное название, поддержка, объявление и режим обслуживания' }) settings() { return this.platform.settings(true); }
}
