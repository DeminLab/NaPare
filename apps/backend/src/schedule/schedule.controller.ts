import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { ScheduleService } from './schedule.service';
import { AcademicCalendarService } from './academic-calendar.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ValidateLessonDto } from './dto/validate-lesson.dto';
import { ExpandSeriesDto } from './dto/expand-series.dto';
import { ScheduleSeriesService } from './schedule-series.service';
import { ScheduleReadService } from './schedule-read.service';
import { ScheduleRangeV2QueryDto } from './dto/schedule-range-v2-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { PaginatedResponseDto, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ScheduleQueryDto } from './dto/schedule-query.dto';
import { WeekTypeQueryDto } from './dto/week-type-query.dto';

@ApiTags('schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly academicCalendarService: AcademicCalendarService,
    private readonly scheduleSeriesService: ScheduleSeriesService,
    private readonly scheduleReadService: ScheduleReadService,
  ) {}

  @Get('my')
  @ApiOperation({ summary: 'Получить моё расписание' })
  @ApiOkResponse({ description: 'Расписание получено', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findMy(
    @Request() req,
    @Query() query: DateRangeQueryDto,
  ) {
    if (req.user.role === UserRole.STUDENT) return this.scheduleService.findForStudentDateRange(req.user.organizationId, req.user.groupId, query.startDate, query.endDate, query);
    if (req.user.role === UserRole.TEACHER) return this.scheduleService.findByTeacherDateRange(req.user.organizationId, req.user.id, query.startDate, query.endDate, query);
    return this.scheduleService.findByDateRange(req.user.organizationId, query.startDate, query.endDate, query);
  }

  @Get()
  @ApiOperation({ summary: 'Получить расписание на дату' })
  @ApiOkResponse({ description: 'Расписание получено', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req,
    @Query() query: ScheduleQueryDto,
  ) {
    const organizationId = req.user.organizationId;
    if (req.user.role === UserRole.STUDENT) return this.scheduleService.findForStudentDate(organizationId, req.user.groupId, query.date, query);
    if (req.user.role === UserRole.TEACHER) return this.scheduleService.findByTeacher(organizationId, req.user.id, query.date, query);

    if (query.groupId) {
      return this.scheduleService.findByGroup(organizationId, query.groupId, query.date, query);
    }

    if (query.teacherId) {
      return this.scheduleService.findByTeacher(organizationId, query.teacherId, query.date, query);
    }

    return this.scheduleService.findByDate(organizationId, query.date, query);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Получить урок по ID' })
  @ApiResponse({ status: 200, description: 'Урок найден' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findLesson(@Param('id') id: string, @Request() req) {
    return this.scheduleService.findAccessibleById(id, req.user);
  }

  @Get('lessons/:id/changes')
  @ApiOperation({ summary: 'Получить изменения урока' })
  @ApiOkResponse({ description: 'Изменения получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getLessonChanges(@Param('id') id: string, @Request() req, @Query() pagination: PaginationQueryDto) {
    await this.scheduleService.findAccessibleById(id, req.user);
    return this.scheduleService.getLessonChanges(id, pagination);
  }

  @Get('range')
  @ApiOperation({ summary: 'Получить расписание за период' })
  @ApiOkResponse({ description: 'Расписание получено', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findByDateRange(
    @Request() req,
    @Query() query: DateRangeQueryDto,
  ) {
    if (req.user.role === UserRole.STUDENT) return this.scheduleService.findForStudentDateRange(req.user.organizationId, req.user.groupId, query.startDate, query.endDate, query);
    if (req.user.role === UserRole.TEACHER) return this.scheduleService.findByTeacherDateRange(req.user.organizationId, req.user.id, query.startDate, query.endDate, query);
    return this.scheduleService.findByDateRange(req.user.organizationId, query.startDate, query.endDate, query);
  }

  @Get('changes')
  @ApiOperation({ summary: 'Получить изменения в расписании' })
  @ApiOkResponse({ description: 'Изменения получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getChanges(@Request() req, @Query() query: ScheduleQueryDto) {
    return this.scheduleService.getChangedLessons(req.user.organizationId, query.date, query);
  }

  @Get('week-type')
  @ApiOperation({ summary: 'Получить тип и номер недели по учебному календарю' })
  @ApiOkResponse({ description: 'Тип недели получен' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Дата вне активного учебного календаря' })
  async getWeekType(@Request() req, @Query() query: WeekTypeQueryDto) {
    return this.academicCalendarService.getWeekType(req.user.organizationId ?? null, query.date);
  }

  @Get('v2')
  @ApiOperation({ summary: 'Единое расписание за период: занятия и academic occurrences в одном ответе' })
  @ApiOkResponse({ description: 'Расписание сгруппировано по дням' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findRangeV2(@Request() req, @Query() query: ScheduleRangeV2QueryDto) {
    return this.scheduleReadService.readRange(req.user, query);
  }

  @Post('series/expand')
  @Roles(UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Создать занятия на период по всем сериям своего университета' })
  @ApiResponse({ status: 201, description: 'Генерация выполнена или показан план' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async expandOrganizationSeries(@Request() req, @Body() dto: ExpandSeriesDto) {
    return this.scheduleSeriesService.expandOrganization(req.user.organizationId, dto);
  }

  @Post('series/:id/expand')
  @Roles(UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Создать занятия на период по одной серии' })
  @ApiResponse({ status: 201, description: 'Генерация выполнена или показан план' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Серия не найдена' })
  async expandSeries(@Param('id') id: string, @Body() dto: ExpandSeriesDto) {
    return this.scheduleSeriesService.expandSeries(id, dto);
  }

  @Post('validate')
  @Roles(UserRole.TEACHER, UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Проверить занятие на конфликты без сохранения' })
  @ApiResponse({ status: 200, description: 'Проверка выполнена' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async validate(@Request() req, @Body() dto: ValidateLessonDto) {
    const dayOfWeek = dto.dayOfWeek ?? new Date(`${dto.startDate.slice(0, 10)}T00:00:00.000Z`).getUTCDay();
    const conflicts = await this.scheduleService.findConflicts(
      { ...dto, dayOfWeek, organizationId: req.user.organizationId },
      dto.lessonId,
    );
    return { ok: conflicts.length === 0, conflicts };
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Создать урок' })
  @ApiResponse({ status: 201, description: 'Урок создан' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Request() req, @Body() createLessonDto: CreateLessonDto) {
    return this.scheduleService.create({
      ...createLessonDto,
      organizationId: req.user.organizationId,
    });
  }

  @Patch(':id')
  @Roles(UserRole.TEACHER, UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Обновить урок' })
  @ApiResponse({ status: 200, description: 'Урок обновлён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.scheduleService.update(id, updateLessonDto);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER, UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Удалить урок' })
  @ApiResponse({ status: 200, description: 'Урок удалён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async delete(@Param('id') id: string) {
    return this.scheduleService.delete(id);
  }
}
