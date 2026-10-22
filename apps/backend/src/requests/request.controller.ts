import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestService } from './request.service';
import { CreateRequestDto, DispatcherQueryDto, OfficeAssignmentDto, OfficeRouteDto, RequestCommandDto, RequestQueryDto } from './request.dto';

@ApiTags('academic-office')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestController {
  constructor(private readonly requests: RequestService) {}
  @Get('context') @ApiOperation({ summary: 'Действующие назначения и подразделения учебного офиса' })
  context() { return this.requests.context(); }
  @Get('dispatch/lessons') @ApiOperation({ summary: 'Расписание назначенной диспетчеру группы' })
  dispatchLessons(@Query() query: DispatcherQueryDto) { return this.requests.dispatchLessons(query); }
  @Get('candidates') @ApiOperation({ summary: 'Сотрудники своего вуза для настройки назначений' })
  candidates(@Query() query: RequestQueryDto) { return this.requests.candidates(query); }
  @Get('students') @ApiOperation({ summary: 'Студенты группы для разрешённой подачи от их имени' })
  students(@Query() query: RequestQueryDto) { return this.requests.students(query); }
  @Get('students/:studentId/debts') @ApiOperation({ summary: 'Источник академических задолженностей, без вымышленных оценок' })
  debts(@Param('studentId', ParseUUIDPipe) id: string) { return this.requests.debts(id); }
  @Get('assignments') @ApiOperation({ summary: 'Назначения сотрудников в своём вузе' })
  assignments() { return this.requests.assignments(); }
  @Post('assignments') @ApiOperation({ summary: 'Дополнительная обязанность с явным scope' })
  assign(@Body() dto: OfficeAssignmentDto) { return this.requests.assign(dto); }
  @Delete('assignments/:id') @ApiOperation({ summary: 'Отозвать назначение с сохранением истории' })
  revoke(@Param('id', ParseUUIDPipe) id: string) { return this.requests.revoke(id); }
  @Get('routes') @ApiOperation({ summary: 'Маршруты согласования групп своего вуза' })
  routes() { return this.requests.routes(); }
  @Put('routes') @ApiOperation({ summary: 'Настроить новую версию маршрута' })
  configureRoute(@Body() dto: OfficeRouteDto) { return this.requests.configureRoute(dto); }
  @Get('report') @ApiOperation({ summary: 'Страница отчёта по доступным заявлениям и срокам' })
  report(@Query() query: RequestQueryDto) { return this.requests.list(query); }
  @Get() @ApiOperation({ summary: 'Очередь заявлений в пределах назначений' })
  list(@Query() query: RequestQueryDto) { return this.requests.list(query); }
  @Post() @ApiOperation({ summary: 'Создать свой черновик или разрешённое заявление от имени студента' })
  create(@Body() dto: CreateRequestDto) { return this.requests.create(dto); }
  @Get(':id') @ApiOperation({ summary: 'Заявление, текущие этапы и неизменяемая история решений' })
  get(@Param('id', ParseUUIDPipe) id: string) { return this.requests.get(id); }
  @Post(':id/commands') @HttpCode(200) @ApiOperation({ summary: 'Идемпотентная команда с optimistic version' })
  command(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestCommandDto) { return this.requests.command(id, dto); }
}
