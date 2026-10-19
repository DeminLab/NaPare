import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAcademicOccurrencesQueryDto, PlatformAcademicOccurrencePatchDto } from './platform-academic.dto';
import { PlatformAcademicService } from './platform-academic.service';

@ApiTags('platform-academic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-academic/occurrences')
export class PlatformAcademicController {
  constructor(private readonly service: PlatformAcademicService) {}

  @Get()
  @ApiOperation({ summary: 'Глобальный поиск занятий в расписании' })
  list(@Query() query: PlatformAcademicOccurrencesQueryDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.list(query, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.detail(id, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Исправить управляемое вручную занятие с обязательной причиной' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAcademicOccurrencePatchDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.update(id, dto, { ip: req.ip, userAgent: req.get('user-agent') });
  }
}
