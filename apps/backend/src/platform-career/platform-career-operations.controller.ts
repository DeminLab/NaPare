import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformCareerApplicationDecisionDto, PlatformCareerOperationPatchDto, PlatformCareerOperationQueryDto, PlatformCareerWorkDecisionDto } from './platform-career-operations.dto';
import { PlatformCareerOperationsService } from './platform-career-operations.service';

@ApiTags('platform-career-operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-career')
export class PlatformCareerOperationsController {
  constructor(private readonly operations: PlatformCareerOperationsService) {}

  @Get('applications')
  @ApiOperation({ summary: 'Глобальный поиск откликов на карьерные задачи' })
  applications(@Query() query: PlatformCareerOperationQueryDto, @Req() request: Request) {
    return this.operations.applications(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Просмотреть текст карьерного отклика с аудитом' })
  application(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.operations.application(id, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Patch('applications/:id')
  @ApiOperation({ summary: 'Исправить текст карьерного отклика' })
  patchApplication(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerOperationPatchDto, @Req() request: Request) {
    return this.operations.patchApplication(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Post('applications/:id/decision')
  @ApiOperation({ summary: 'Выбрать кандидата или закрыть отклик с аудитом' })
  decideApplication(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerApplicationDecisionDto, @Req() request: Request) {
    return this.operations.decideApplication(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('works')
  @ApiOperation({ summary: 'Глобальный поиск карьерных работ' })
  works(@Query() query: PlatformCareerOperationQueryDto, @Req() request: Request) {
    return this.operations.works(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('works/:id')
  @ApiOperation({ summary: 'Просмотреть результат карьерной работы с аудитом' })
  work(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.operations.work(id, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Patch('works/:id')
  @ApiOperation({ summary: 'Исправить результат или ссылку на карьерную работу' })
  patchWork(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerOperationPatchDto, @Req() request: Request) {
    return this.operations.patchWork(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Post('works/:id/decision')
  @ApiOperation({ summary: 'Принять результат или запросить доработку' })
  decideWork(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformCareerWorkDecisionDto, @Req() request: Request) {
    return this.operations.decideWork(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }
}
