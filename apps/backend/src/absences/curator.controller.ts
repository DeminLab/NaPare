import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { AbsencesService } from '../absences/absences.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';
import { PaginatedResponseDto, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AbsenceListQueryDto } from './dto/absence-list-query.dto';
import { ConfirmAbsenceDto } from './dto/confirm-absence.dto';
import { RejectAbsenceDto } from './dto/reject-absence.dto';

@ApiTags('curator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('curator')
export class CuratorController {
  constructor(private readonly absencesService: AbsencesService) {}

  @Get('absences')
  @Roles(UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Получить пропуски на подтверждении' })
  @ApiOkResponse({ description: 'Пропуски получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAbsences(
    @Request() req,
    @Query() query: AbsenceListQueryDto,
  ) {
    return this.absencesService.findByUniversity(
      req.user.universityId,
      query.status,
      query,
    );
  }

  @Patch('absences/:id/confirm')
  @Roles(UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Подтвердить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск подтверждён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async confirmAbsence(
    @Param('id') id: string,
    @Request() req,
    @Body() confirmAbsenceDto: ConfirmAbsenceDto,
  ) {
    return this.absencesService.confirm(id, req.user.id, confirmAbsenceDto.comment);
  }

  @Patch('absences/:id/reject')
  @Roles(UserRole.CURATOR, UserRole.DEPARTMENT_HEAD, UserRole.FACULTY_DEAN, UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Отклонить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск отклонён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async rejectAbsence(
    @Param('id') id: string,
    @Request() req,
    @Body() rejectAbsenceDto: RejectAbsenceDto,
  ) {
    return this.absencesService.reject(id, req.user.id, rejectAbsenceDto.reason);
  }
}
