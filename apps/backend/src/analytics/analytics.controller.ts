import { Body, Controller, Get, Header, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AnalyticsReportDto, AnalyticsReadinessDto } from './analytics.dto';
import { ProductAnalyticsService } from './analytics.service';

@ApiTags('analytics') @ApiBearerAuth() @Controller('analytics')
@UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.UNIVERSITY_ADMIN)
export class ProductAnalyticsController {
  constructor(private readonly analytics:ProductAnalyticsService){}
  @Get('report') @Header('Cache-Control','no-store, private')
  report(@Request() request:{user:AuthenticatedUser},@Query() query:AnalyticsReportDto){return this.analytics.report(request.user,query);}
  @Post('onboarding-observation') @Header('Cache-Control','no-store, private')
  readiness(@Request() request:{user:AuthenticatedUser},@Body() dto:AnalyticsReadinessDto){return this.analytics.observeReadiness(request.user,dto);}
}
