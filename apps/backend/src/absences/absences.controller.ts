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
  Delete,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { AbsencesService } from './absences.service';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';
import { RejectAbsenceDto } from './dto/reject-absence.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';
import { PaginatedResponseDto, PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('absences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('absences')
export class AbsencesController {
  constructor(private readonly absencesService: AbsencesService) {}

  @Get('my')
  @ApiOperation({ summary: 'Получить мои пропуски' })
  @ApiOkResponse({ description: 'Пропуски получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findMy(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.absencesService.findByStudent(req.user.id, pagination);
  }

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Получить пропуски студента' })
  @Roles(UserRole.TEACHER, UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOkResponse({ description: 'Пропуски получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findByStudent(@Param('studentId') studentId: string, @Query() pagination: PaginationQueryDto) {
    return this.absencesService.findByStudent(studentId, pagination);
  }

  @Get('lesson/:lessonId')
  @ApiOperation({ summary: 'Получить пропуски на уроке' })
  @Roles(UserRole.TEACHER, UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOkResponse({ description: 'Пропуски получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findByLesson(@Param('lessonId') lessonId: string, @Query() pagination: PaginationQueryDto) {
    return this.absencesService.findByLesson(lessonId, pagination);
  }

  @Get('stats/:studentId')
  @ApiOperation({ summary: 'Получить статистику пропусков' })
  @Roles(UserRole.TEACHER, UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiResponse({ status: 200, description: 'Статистика получена' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getStats(
    @Request() req,
    @Param('studentId') studentId: string,
  ) {
    return this.absencesService.getStats(req.user.universityId, studentId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать пропуск' })
  @ApiResponse({ status: 201, description: 'Пропуск создан' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Request() req, @Body() createAbsenceDto: CreateAbsenceDto) {
    return this.absencesService.create(createAbsenceDto, req.user.universityId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск обновлён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateAbsenceDto: UpdateAbsenceDto,
  ) {
    return this.absencesService.update(id, updateAbsenceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск удалён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async delete(@Param('id') id: string) {
    return this.absencesService.delete(id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Подтвердить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск подтверждён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async confirm(@Param('id') id: string, @Request() req) {
    return this.absencesService.confirm(id, req.user.id);
  }

  @Post(':id/excuse')
  @ApiOperation({ summary: 'Освободить от пропуска' })
  @ApiResponse({ status: 200, description: 'Пропуск освобождён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async excuse(
    @Param('id') id: string,
    @Request() req,
    @Body() rejectAbsenceDto: RejectAbsenceDto,
  ) {
    return this.absencesService.reject(id, req.user.id, rejectAbsenceDto.reason);
  }
}
