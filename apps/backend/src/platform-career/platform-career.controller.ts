import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  PlatformCareerAdmissionPatchDto,
  PlatformCareerAdmissionQueryDto,
  PlatformCareerDecisionDto,
  PlatformCareerProfilePatchDto,
  PlatformCareerProfileQueryDto,
} from './platform-career.dto';
import { PlatformCareerService } from './platform-career.service';

@ApiTags('platform-career')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-career')
export class PlatformCareerController {
  constructor(private readonly career: PlatformCareerService) {}

  @Get('profiles')
  @ApiOperation({ summary: 'Глобальный поиск карьерных профилей студентов' })
  profiles(@Query() query: PlatformCareerProfileQueryDto, @Req() request: Request) { return this.career.profiles(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('profiles/:id')
  @ApiOperation({ summary: 'Просмотреть карьерный профиль с аудитом доступа' })
  profile(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.profile(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('profiles/:id')
  @ApiOperation({ summary: 'Исправить карьерный профиль с возвратом на повторную проверку' })
  patchProfile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerProfilePatchDto, @Req() request: Request) { return this.career.patchProfile(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Post('profiles/:id/decision')
  @ApiOperation({ summary: 'Подтвердить или отклонить карьерный профиль' })
  decideProfile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerDecisionDto, @Req() request: Request) { return this.career.decideProfile(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('admissions')
  @ApiOperation({ summary: 'Глобальный поиск карьерных допусков студентов' })
  admissions(@Query() query: PlatformCareerAdmissionQueryDto, @Req() request: Request) { return this.career.admissions(query, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Get('admissions/:id')
  @ApiOperation({ summary: 'Просмотреть заявку на карьерный допуск с аудитом доступа' })
  admission(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.career.admission(id, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Patch('admissions/:id')
  @ApiOperation({ summary: 'Исправить заявку на допуск с возвратом на повторное рассмотрение' })
  patchAdmission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerAdmissionPatchDto, @Req() request: Request) { return this.career.patchAdmission(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Post('admissions/:id/decision')
  @ApiOperation({ summary: 'Одобрить или отклонить карьерный допуск' })
  decideAdmission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerDecisionDto, @Req() request: Request) { return this.career.decideAdmission(id, dto, { ip: request.ip, userAgent: request.get('user-agent') }); }
}
