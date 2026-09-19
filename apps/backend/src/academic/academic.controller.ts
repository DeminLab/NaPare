import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/authorization/permissions.guard';
import { RequiresPermission } from '../common/authorization/permissions.decorator';
import { PERMISSIONS } from '../common/authorization/permissions';
import { PaginatedResponseDto, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AcademicService } from './academic.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateLessonSeriesDto } from './dto/create-lesson-series.dto';
import { CreateLessonOccurrenceDto } from './dto/create-lesson-occurrence.dto';
import { UpdateLessonOccurrenceDto } from './dto/update-lesson-occurrence.dto';
import { AcademicEventQueryDto } from './dto/academic-event-query.dto';
import { CreateAcademicEventDto } from './dto/create-academic-event.dto';
import { Course } from './entities/course.entity';
import { LessonSeries } from './entities/lesson-series.entity';
import { LessonOccurrence } from './entities/lesson-occurrence.entity';
import { AcademicEvent } from './entities/academic-event.entity';
import { CourseSpace } from './entities/course-space.entity';
import { ScheduleChange } from './entities/schedule-change.entity';

@ApiTags('academic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('courses')
  @RequiresPermission(PERMISSIONS.ACADEMIC_COURSE_READ)
  @ApiOperation({ summary: 'Получить курсы в доступном resource scope' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findCourses(@Request() req, @Query() query: PaginationQueryDto) {
    return this.academicService.findCourses(req.user.universityId, query);
  }

  @Post('courses')
  @RequiresPermission(PERMISSIONS.ACADEMIC_COURSE_MANAGE)
  @ApiOperation({ summary: 'Создать постоянную сущность курса' })
  @ApiResponse({ status: 201, type: Course })
  async createCourse(@Request() req, @Body() dto: CreateCourseDto) {
    return this.academicService.createCourse(req.user.universityId, dto);
  }

  @Get('courses/:id')
  @RequiresPermission(PERMISSIONS.ACADEMIC_COURSE_READ)
  @ApiOperation({ summary: 'Получить курс в доступном resource scope' })
  @ApiResponse({ status: 200, type: Course })
  async getCourse(@Param('id') id: string) {
    return this.academicService.getCourse(id);
  }

  @Patch('courses/:id')
  @RequiresPermission(PERMISSIONS.ACADEMIC_COURSE_MANAGE)
  @ApiOperation({ summary: 'Обновить курс' })
  @ApiResponse({ status: 200, type: Course })
  async updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.academicService.updateCourse(id, dto);
  }

  @Get('courses/:courseId/space')
  @RequiresPermission(PERMISSIONS.ACADEMIC_COURSE_READ)
  @ApiOperation({ summary: 'Получить Course Space' })
  @ApiResponse({ status: 200, type: CourseSpace })
  async getCourseSpace(@Param('courseId') courseId: string) {
    return this.academicService.getCourseSpace(courseId);
  }

  @Get('courses/:courseId/series')
  @RequiresPermission(PERMISSIONS.ACADEMIC_SERIES_READ)
  @ApiOperation({ summary: 'Получить регулярные серии занятий курса' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findSeries(@Param('courseId') courseId: string, @Query() query: PaginationQueryDto) {
    return this.academicService.findSeries(courseId, query);
  }

  @Post('courses/:courseId/series')
  @RequiresPermission(PERMISSIONS.ACADEMIC_SERIES_MANAGE)
  @ApiOperation({ summary: 'Создать регулярную серию занятий' })
  @ApiResponse({ status: 201, type: LessonSeries })
  async createSeries(@Param('courseId') courseId: string, @Body() dto: CreateLessonSeriesDto) {
    return this.academicService.createSeries(courseId, dto);
  }

  @Get('occurrences')
  @RequiresPermission(PERMISSIONS.ACADEMIC_OCCURRENCE_READ)
  @ApiOperation({ summary: 'Получить конкретные занятия в доступном scope' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findOccurrences(@Request() req, @Query() query: AcademicEventQueryDto) {
    return this.academicService.findOccurrences(req.user.universityId, query);
  }

  @Get('occurrences/:id/context')
  @RequiresPermission(PERMISSIONS.ACADEMIC_OCCURRENCE_READ)
  @ApiOperation({ summary: 'Получить единый academic context занятия' })
  async getOccurrenceContext(@Param('id') id: string) {
    return this.academicService.getOccurrenceContext(id);
  }

  @Get('occurrences/:id/space')
  @RequiresPermission(PERMISSIONS.ACADEMIC_OCCURRENCE_READ)
  @ApiOperation({ summary: 'Получить Lesson Space конкретной пары' })
  async getLessonSpace(@Param('id') id: string) {
    return this.academicService.getLessonSpace(id);
  }

  @Post('series/:seriesId/occurrences')
  @RequiresPermission(PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE)
  @ApiOperation({ summary: 'Создать occurrence конкретной пары' })
  @ApiResponse({ status: 201, type: LessonOccurrence })
  async createOccurrence(@Param('seriesId') seriesId: string, @Body() dto: CreateLessonOccurrenceDto) {
    return this.academicService.createOccurrence(seriesId, dto);
  }

  @Patch('occurrences/:id')
  @RequiresPermission(PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE)
  @ApiOperation({ summary: 'Изменить occurrence и сохранить schedule change' })
  @ApiResponse({ status: 200, type: LessonOccurrence })
  async updateOccurrence(@Param('id') id: string, @Body() dto: UpdateLessonOccurrenceDto) {
    return this.academicService.updateOccurrence(id, dto);
  }

  @Get('occurrences/:id/changes')
  @RequiresPermission(PERMISSIONS.ACADEMIC_OCCURRENCE_READ)
  @ApiOperation({ summary: 'Получить историю изменений occurrence' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async listScheduleChanges(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.academicService.listScheduleChanges(id, query);
  }

  @Get('events')
  @RequiresPermission(PERMISSIONS.ACADEMIC_EVENT_READ)
  @ApiOperation({ summary: 'Получить Academic Events в доступном scope' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async findAcademicEvents(@Request() req, @Query() query: AcademicEventQueryDto) {
    return this.academicService.findAcademicEvents(req.user.universityId, query);
  }

  @Post('events')
  @RequiresPermission(PERMISSIONS.ACADEMIC_EVENT_MANAGE)
  @ApiOperation({ summary: 'Создать Academic Event в resource scope' })
  @ApiResponse({ status: 201, type: AcademicEvent })
  async createAcademicEvent(@Request() req, @Body() dto: CreateAcademicEventDto) {
    return this.academicService.createAcademicEvent(req.user.universityId, dto);
  }
}
