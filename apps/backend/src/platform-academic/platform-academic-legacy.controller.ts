import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAcademicLegacyService } from './platform-academic-legacy.service';
import { PlatformAcademicLessonPatchDto, PlatformAcademicLessonsQueryDto } from './platform-academic-legacy.dto';

@ApiTags('platform-academic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-academic/lessons')
export class PlatformAcademicLegacyController {
  constructor(private readonly service: PlatformAcademicLegacyService) {}

  @Get()
  @ApiOperation({ summary: 'Найти legacy-занятия без LessonOccurrence' })
  list(@Query() query: PlatformAcademicLessonsQueryDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.list(query, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.detail(id, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Исправить legacy-занятие без LessonOccurrence с обязательной причиной' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAcademicLessonPatchDto, @Request() req: { ip: string; get(name: string): string | undefined }) {
    return this.service.update(id, dto, { ip: req.ip, userAgent: req.get('user-agent') });
  }
}
