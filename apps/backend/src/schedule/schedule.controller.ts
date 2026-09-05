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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

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

  @Get()
  @ApiOperation({ summary: 'Получить расписание на дату' })
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

  @Get('range')
  @ApiOperation({ summary: 'Получить расписание за период' })
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
  @ApiQuery({ name: 'date', required: true })
  async getChanges(@Request() req, @Query('date') date: string) {
    return this.scheduleService.getChangedLessons(req.user.universityId, date);
  }

  @Post()
  @ApiOperation({ summary: 'Создать урок' })
  async create(@Request() req, @Body() createLessonDto: CreateLessonDto) {
    return this.scheduleService.create({
      ...createLessonDto,
      universityId: req.user.universityId,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить урок' })
  async update(
    @Param('id') id: string,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.scheduleService.update(id, updateLessonDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить урок' })
  async delete(@Param('id') id: string) {
    return this.scheduleService.delete(id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Импортировать расписание' })
  async import(@Request() req, @Body() lessons: CreateLessonDto[]) {
    return this.scheduleService.importLessons(req.user.universityId, lessons);
  }
}
