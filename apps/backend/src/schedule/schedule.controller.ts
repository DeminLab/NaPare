import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { ScheduleService } from './schedule.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('my')
  @ApiOperation({ summary: 'Получить моё расписание' })
  @ApiResponse({ status: 200, description: 'Расписание получено' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async findMy(
    @Request() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.scheduleService.findByDateRange(
      req.user.universityId,
      startDate,
      endDate,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Получить расписание на дату' })
  @ApiResponse({ status: 200, description: 'Расписание получено' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'group', required: false })
  @ApiQuery({ name: 'teacherId', required: false })
  async findAll(
    @Request() req,
    @Query('date') date: string,
    @Query('group') group?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    const universityId = req.user.universityId;

    if (group) {
      return this.scheduleService.findByGroup(universityId, group, date);
    }

    if (teacherId) {
      return this.scheduleService.findByTeacher(universityId, teacherId, date);
    }

    return this.scheduleService.findByDate(universityId, date);
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
  @ApiResponse({ status: 200, description: 'Изменения получены' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getLessonChanges(@Param('id') id: string) {
    return this.scheduleService.getLessonChanges(id);
  }

  @Get('range')
  @ApiOperation({ summary: 'Получить расписание за период' })
  @ApiResponse({ status: 200, description: 'Расписание получено' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async findByDateRange(
    @Request() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.scheduleService.findByDateRange(
      req.user.universityId,
      startDate,
      endDate,
    );
  }

  @Get('changes')
  @ApiOperation({ summary: 'Получить изменения в расписании' })
  @ApiResponse({ status: 200, description: 'Изменения получены' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'date', required: true })
  async getChanges(@Request() req, @Query('date') date: string) {
    return this.scheduleService.getChangedLessons(req.user.universityId, date);
  }

  @Post()
  @ApiOperation({ summary: 'Создать урок' })
  @ApiResponse({ status: 201, description: 'Урок создан' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Request() req, @Body() createLessonDto: CreateLessonDto) {
    return this.scheduleService.create({
      ...createLessonDto,
      universityId: req.user.universityId,
    });
  }

  @Put(':id')
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
  @ApiOperation({ summary: 'Удалить урок' })
  @ApiResponse({ status: 200, description: 'Урок удалён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async delete(@Param('id') id: string) {
    return this.scheduleService.delete(id);
  }
}
