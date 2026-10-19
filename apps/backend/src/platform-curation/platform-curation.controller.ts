import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformCurationAssignmentDto, PlatformCurationQueryDto, PlatformCurationResourceQueryDto, PlatformCurationRevokeDto } from './platform-curation.dto';
import { PlatformCurationService } from './platform-curation.service';

@ApiTags('platform-curation') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('platform-curation')
export class PlatformCurationController {
  constructor(private readonly curation: PlatformCurationService) {}
  @Get('assignments') @ApiOperation({ summary: 'Поиск назначений кураторов по университетам' }) assignments(@Query() query: PlatformCurationQueryDto, @Req() req: Request) { return this.curation.assignments(query, this.context(req)); }
  @Get('assignments/:id') @ApiOperation({ summary: 'Карточка назначения и история его действия' }) assignment(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) { return this.curation.assignment(id, this.context(req)); }
  @Get('groups') @ApiOperation({ summary: 'Поиск групп университета для назначения куратора' }) groups(@Query() query: PlatformCurationResourceQueryDto, @Req() req: Request) { return this.curation.groups(query, this.context(req)); }
  @Get('candidates') @ApiOperation({ summary: 'Поиск активных аккаунтов университета для назначения куратором' }) candidates(@Query() query: PlatformCurationResourceQueryDto, @Req() req: Request) { return this.curation.candidates(query, this.context(req)); }
  @Post('assignments') @ApiOperation({ summary: 'Назначить аккаунт куратором группы' }) grant(@Body() dto: PlatformCurationAssignmentDto, @Req() req: Request) { return this.curation.grant(dto, this.context(req)); }
  @Patch('assignments/:id/revoke') @ApiOperation({ summary: 'Мягко отозвать назначение куратора' }) revoke(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCurationRevokeDto, @Req() req: Request) { return this.curation.revoke(id, dto, this.context(req)); }
  private context(request: Request) { return { ip: request.ip, userAgent: request.get('user-agent') }; }
}
