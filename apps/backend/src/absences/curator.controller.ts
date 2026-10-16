import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { AbsencesService } from '../absences/absences.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginatedResponseDto } from '../common/dto/pagination-query.dto';
import { AbsenceListQueryDto } from './dto/absence-list-query.dto';
import { ConfirmAbsenceDto } from './dto/confirm-absence.dto';
import { RejectAbsenceDto } from './dto/reject-absence.dto';
import { CurationService } from '../curation/curation.service';

@ApiTags('curator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('curator')
export class CuratorController {
  constructor(private readonly absencesService: AbsencesService, private readonly curation: CurationService) {}

  @Get('absences')
  @ApiOperation({ summary: 'Получить пропуски на подтверждении' })
  @ApiOkResponse({ description: 'Пропуски получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAbsences(
    @Request() req,
    @Query() query: AbsenceListQueryDto,
  ) {
    return this.curation.absences(query, false);
  }

  @Patch('absences/:id/confirm')
  @ApiOperation({ summary: 'Подтвердить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск подтверждён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async confirmAbsence(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() confirmAbsenceDto: ConfirmAbsenceDto,
  ) {
    return this.absencesService.confirm(id, req.user.id, confirmAbsenceDto.comment, false);
  }

  @Patch('absences/:id/reject')
  @ApiOperation({ summary: 'Отклонить пропуск' })
  @ApiResponse({ status: 200, description: 'Пропуск отклонён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async rejectAbsence(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Body() rejectAbsenceDto: RejectAbsenceDto,
  ) {
    return this.absencesService.reject(id, req.user.id, rejectAbsenceDto.reason, false);
  }
}
