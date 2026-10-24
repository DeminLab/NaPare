import { Controller, Get, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CareerReportService } from './career-report.service';

@ApiTags('career') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('career/center')
export class CareerReportController {
  constructor(private readonly reports: CareerReportService) {}

  @Get('report') @ApiOperation({ summary: 'Агрегаты карьерного центра только своего вуза' })
  async report(@Request() request: { user: AuthenticatedUser }, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store, private');
    return this.reports.snapshot(request.user);
  }

  @Get('report.xlsx') @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'XLSX-отчёт карьерного центра только своего вуза' })
  async download(@Request() request: { user: AuthenticatedUser }, @Res() response: Response) {
    const report = await this.reports.snapshot(request.user);
    const buffer = await this.reports.workbook(report);
    response.set({ 'Cache-Control': 'no-store, private',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="napare-career-report.xlsx"',
      'X-NaPare-University-Id': report.universityId,
      'X-Content-Type-Options': 'nosniff' });
    response.send(buffer);
  }
}
