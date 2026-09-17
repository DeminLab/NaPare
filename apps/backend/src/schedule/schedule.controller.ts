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
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { PaginatedResponseDto, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ScheduleQueryDto } from './dto/schedule-query.dto';

@ApiTags('schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('my')
  @ApiOperation({ summary: 'Получить моё расписание' })
  @ApiOkResponse({ description: 'Расписание получено', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findMy(
    @Request() req,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.scheduleService.findForStudentDateRange(
      req.user.universityId,
      req.user.groupId,
      query.startDate,
      query.endDate,
      query,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Получить расписание на дату' })
  @ApiOkResponse({ description: 'Расписание получено', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req,
    @Query() query: ScheduleQueryDto,
  ) {
    const universityId = req.user.universityId;

    if (query.groupId) {
      return this.scheduleService.findByGroup(universityId, query.groupId, query.date, query);
    }

    if (query.teacherId) {
      return this.scheduleService.findByTeacher(universityId, query.teacherId, query.date, query);
    }

    return this.scheduleService.findByDate(universityId, query.date, query);
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Получить урок по ID' })
  @ApiResponse({ status: 200, description: 'Урок найден' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findLesson(@Param('id') id: string) {
    return this.scheduleService.findById(id);
  }

  @Get('lessons/:id/changes')
  @ApiOperation({ summary: 'Получить изменения урока' })
  @ApiOkResponse({ description: 'Изменения получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getLessonChanges(@Param('id') id: string, @Query() pagination: PaginationQueryDto) {
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
    return this.scheduleService.findForStudentDateRange(
      req.user.universityId,
      req.user.groupId,
      query.startDate,
      query.endDate,
      query,
    );
  }

  @Get('changes')
  @ApiOperation({ summary: 'Получить изменения в расписании' })
  @ApiOkResponse({ description: 'Изменения получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getChanges(@Request() req, @Query() query: ScheduleQueryDto) {
    return this.scheduleService.getChangedLessons(req.user.universityId, query.date, query);
  }

  @Post()
  @Roles(UserRole.TEACHER, UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Создать урок' })
  @ApiResponse({ status: 201, description: 'Урок создан' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Request() req, @Body() createLessonDto: CreateLessonDto) {
    return this.scheduleService.create({
      ...createLessonDto,
      universityId: req.user.universityId,
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
