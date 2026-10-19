import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformDataService } from './platform-data.service';
import { PlatformAbsenceConfirmationCorrectionDto, PlatformAbsenceConfirmationQueryDto, PlatformAbsenceCorrectionDto, PlatformAbsenceQueryDto, PlatformAttendanceCorrectionDto, PlatformAttendanceQueryDto } from './platform-data.dto';

@ApiTags('platform-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-data')
export class PlatformDataController {
  constructor(private readonly platformData: PlatformDataService) {}

  @Get('absences')
  @ApiOperation({ summary: 'Глобальный поиск отсутствий для управления платформой' })
  absences(@Query() query: PlatformAbsenceQueryDto, @Req() request: Request) {
    return this.platformData.absences(query, this.auditContext(request));
  }

  @Patch('absences/:id')
  @ApiOperation({ summary: 'Исправить запись отсутствия с обязательной причиной' })
  correctAbsence(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAbsenceCorrectionDto, @Req() request: Request) {
    return this.platformData.correctAbsence(id, dto, this.auditContext(request));
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Глобальный поиск отметок посещаемости для управления платформой' })
  attendance(@Query() query: PlatformAttendanceQueryDto, @Req() request: Request) {
    return this.platformData.attendance(query, this.auditContext(request));
  }

  @Patch('attendance/:id')
  @ApiOperation({ summary: 'Исправить отметку посещаемости с обязательной причиной' })
  correctAttendance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAttendanceCorrectionDto, @Req() request: Request) {
    return this.platformData.correctAttendance(id, dto, this.auditContext(request));
  }

  @Get('absence-confirmations')
  @ApiOperation({ summary: 'Поиск историй подтверждения отсутствий' })
  absenceConfirmations(@Query() query: PlatformAbsenceConfirmationQueryDto, @Req() request: Request) {
    return this.platformData.absenceConfirmations(query, this.auditContext(request));
  }

  @Get('absence-confirmations/:id')
  @ApiOperation({ summary: 'Просмотр решения по отсутствию' })
  absenceConfirmation(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.platformData.absenceConfirmation(id, this.auditContext(request));
  }

  @Patch('absence-confirmations/:id')
  @ApiOperation({ summary: 'Исправить решение по отсутствию с обязательной причиной' })
  correctAbsenceConfirmation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAbsenceConfirmationCorrectionDto, @Req() request: Request) {
    return this.platformData.correctAbsenceConfirmation(id, dto, this.auditContext(request));
  }

  private auditContext(request: Request) { return { ip: request.ip, userAgent: request.get('user-agent') }; }
}
