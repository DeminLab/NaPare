import { Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OfficeDebtImportDto, OfficeReportQueryDto } from './office-report.dto';
import { OfficeReportService } from './office-report.service';

@ApiTags('academic-office-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests/reports')
export class OfficeReportController {
  constructor(private readonly reports: OfficeReportService) {}
  @Get('contingent') @Header('Cache-Control', 'private, no-store')
  contingent(@Query() query: OfficeReportQueryDto) { return this.reports.contingent(query); }
  @Get('debts') @Header('Cache-Control', 'private, no-store')
  debts(@Query() query: OfficeReportQueryDto) { return this.reports.debts(query); }
  @Post('debt-snapshots') @Header('Cache-Control', 'private, no-store')
  importDebts(@Body() dto: OfficeDebtImportDto) { return this.reports.importDebts(dto); }
}
