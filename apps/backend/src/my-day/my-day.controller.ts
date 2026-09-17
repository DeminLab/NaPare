import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { MyDayService } from './my-day.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('my-day')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('my-day')
export class MyDayController {
  constructor(private readonly myDayService: MyDayService) {}

  @Get()
  @ApiOperation({ summary: 'Получить данные для главного экрана' })
  @ApiResponse({ status: 200, description: 'Данные получены' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyDay(@Request() req) {
    return this.myDayService.getMyDay(
      req.user.id,
      req.user.universityId,
      req.user.role,
      req.user.groupId,
    );
  }
}
