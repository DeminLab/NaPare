import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { AbsencesService } from './absences.service';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('absences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('absences')
export class AbsencesController {
  constructor(private readonly absencesService: AbsencesService) {}

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Получить пропуски студента' })
  async findByStudent(@Param('studentId') studentId: string) {
    return this.absencesService.findByStudent(studentId);
  }

  @Get('lesson/:lessonId')
  @ApiOperation({ summary: 'Получить пропуски на уроке' })
  async findByLesson(@Param('lessonId') lessonId: string) {
    return this.absencesService.findByLesson(lessonId);
  }

  @Get('stats/:studentId')
  @ApiOperation({ summary: 'Получить статистику пропусков' })
  async getStats(
    @Request() req,
    @Param('studentId') studentId: string,
  ) {
    return this.absencesService.getStats(req.user.universityId, studentId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать пропуск' })
  async create(@Body() createAbsenceDto: CreateAbsenceDto) {
    return this.absencesService.create(createAbsenceDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить пропуск' })
  async update(
    @Param('id') id: string,
    @Body() updateAbsenceDto: UpdateAbsenceDto,
  ) {
    return this.absencesService.update(id, updateAbsenceDto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Подтвердить пропуск' })
  async confirm(@Param('id') id: string, @Request() req) {
    return this.absencesService.confirm(id, req.user.id);
  }

  @Post(':id/excuse')
  @ApiOperation({ summary: 'Освободить от пропуска' })
  async excuse(
    @Param('id') id: string,
    @Request() req,
    @Body('reason') reason: string,
  ) {
    return this.absencesService.excuse(id, req.user.id, reason);
  }
}
