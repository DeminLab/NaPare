import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  PlatformAcademicCatalogQueryDto,
  PlatformAcademicCatalogOptionsDto,
  PlatformAcademicCoursePatchDto,
  PlatformAcademicSeriesPatchDto,
} from './platform-academic-catalog.dto';
import { PlatformAcademicCatalogService } from './platform-academic-catalog.service';

@ApiTags('platform-academic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-academic/catalog')
export class PlatformAcademicCatalogController {
  constructor(private readonly service: PlatformAcademicCatalogService) {}

  @Get('options')
  @ApiOperation({ summary: 'Получить безопасные справочники академического каталога одного вуза' })
  options(@Query() query: PlatformAcademicCatalogOptionsDto) {
    return this.service.options(query.universityId);
  }

  @Get('courses')
  @ApiOperation({ summary: 'Найти курсы каталога по всем вузам с разрешённым platform scope' })
  listCourses(@Query() query: PlatformAcademicCatalogQueryDto, @Request() req: AuditRequest) {
    return this.service.listCourses(query, auditContext(req));
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Просмотреть курс каталога и историю аудита' })
  getCourse(@Param('id', ParseUUIDPipe) id: string, @Request() req: AuditRequest) {
    return this.service.getCourse(id, auditContext(req));
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'Исправить ручной курс с причиной и аудитом' })
  patchCourse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformAcademicCoursePatchDto,
    @Request() req: AuditRequest,
  ) {
    return this.service.patchCourse(id, dto, auditContext(req));
  }

  @Get('series')
  @ApiOperation({ summary: 'Найти серии занятий каталога по всем вузам с разрешённым platform scope' })
  listSeries(@Query() query: PlatformAcademicCatalogQueryDto, @Request() req: AuditRequest) {
    return this.service.listSeries(query, auditContext(req));
  }

  @Get('series/:id')
  @ApiOperation({ summary: 'Просмотреть серию занятий и историю аудита' })
  getSeries(@Param('id', ParseUUIDPipe) id: string, @Request() req: AuditRequest) {
    return this.service.getSeries(id, auditContext(req));
  }

  @Patch('series/:id')
  @ApiOperation({ summary: 'Исправить ручной шаблон серии с причиной и аудитом' })
  patchSeries(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformAcademicSeriesPatchDto,
    @Request() req: AuditRequest,
  ) {
    return this.service.patchSeries(id, dto, auditContext(req));
  }
}

type AuditRequest = { ip: string; get(name: string): string | undefined };

function auditContext(req: AuditRequest) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}
