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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { AbsencesService } from '../absences/absences.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('curator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('curator')
export class CuratorController {
  constructor(private readonly absencesService: AbsencesService) {}

  @Get('absences')
  @Roles('curator', 'department_head', 'faculty_dean', 'university_admin', 'superadmin')
  @ApiOperation({ summary: 'Получить пропуски на подтверждении' })
  @ApiResponse({ status: 200, description: 'Пропуски получены' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'status', required: false })
  async getAbsences(
    @Request() req,
    @Query('status') status?: string,
  ) {
    return this.absencesService.findByUniversity(
      req.user.universityId,
      status,
    );
  }

  @Patch('absences/:id/confirm')
  @Roles('curator', 'department_head', 'faculty_dean', 'university_admin', 'superadmin')
  @ApiOperation({ summary: 'Подтвердить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск подтверждён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async confirmAbsence(
    @Param('id') id: string,
    @Request() req,
    @Body('comment') comment?: string,
  ) {
    return this.absencesService.confirm(id, req.user.id, comment);
  }

  @Patch('absences/:id/reject')
  @Roles('curator', 'department_head', 'faculty_dean', 'university_admin', 'superadmin')
  @ApiOperation({ summary: 'Отклонить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск отклонён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async rejectAbsence(
    @Param('id') id: string,
    @Request() req,
    @Body('reason') reason: string,
  ) {
    return this.absencesService.reject(id, req.user.id, reason);
  }
}
