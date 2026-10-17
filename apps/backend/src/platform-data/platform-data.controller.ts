import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformDataService } from './platform-data.service';
import { PlatformAbsenceCorrectionDto, PlatformAbsenceQueryDto, PlatformAttendanceCorrectionDto, PlatformAttendanceQueryDto } from './platform-data.dto';

@ApiTags('platform-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-data')
export class PlatformDataController {
  constructor(private readonly platformData: PlatformDataService) {}

  @Get('absences')
  @ApiOperation({ summary: 'Глобальный поиск отсутствий для управления платформой' })
  absences(@Query() query: PlatformAbsenceQueryDto) {
    return this.platformData.absences(query);
  }

  @Patch('absences/:id')
  @ApiOperation({ summary: 'Исправить запись отсутствия с обязательной причиной' })
  correctAbsence(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAbsenceCorrectionDto) {
    return this.platformData.correctAbsence(id, dto);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Глобальный поиск отметок посещаемости для управления платформой' })
  attendance(@Query() query: PlatformAttendanceQueryDto) {
    return this.platformData.attendance(query);
  }

  @Patch('attendance/:id')
  @ApiOperation({ summary: 'Исправить отметку посещаемости с обязательной причиной' })
  correctAttendance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAttendanceCorrectionDto) {
    return this.platformData.correctAttendance(id, dto);
  }
}
