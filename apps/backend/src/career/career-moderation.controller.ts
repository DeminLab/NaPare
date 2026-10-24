import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CareerModerationService } from './career-moderation.service';
import { CareerComplaintDecisionDto, CareerComplaintDto, CareerModerationDecisionDto, CareerModerationPageDto, CareerMyComplaintPageDto, CareerTaskRevisionDto } from './career-moderation.dto';

type CareerRequest = { user: AuthenticatedUser };
@ApiTags('career') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('career')
export class CareerModerationController {
  constructor(private readonly moderation: CareerModerationService) {}
  @Get('moderation/tasks') @Header('Cache-Control','no-store, private')
  tasks(@Request() req: CareerRequest, @Query() page: CareerModerationPageDto) { return this.moderation.tasks(req.user,page); }
  @Post('moderation/tasks/:id/decision')
  decide(@Request() req: CareerRequest, @Param('id',ParseUUIDPipe) id: string, @Body() dto: CareerModerationDecisionDto) { return this.moderation.decide(req.user,id,dto.decision,dto.reason,dto.expectedVersion); }
  @Patch('tasks/:id')
  revise(@Request() req: CareerRequest, @Param('id',ParseUUIDPipe) id: string, @Body() dto: CareerTaskRevisionDto) { return this.moderation.revise(req.user,id,dto); }
  @Post('tasks/:id/complaints') @Throttle({default:{ttl:60000,limit:3}}) @Header('Cache-Control','no-store, private')
  complain(@Request() req: CareerRequest, @Param('id',ParseUUIDPipe) id: string, @Body() dto: CareerComplaintDto) { return this.moderation.complain(req.user,id,dto); }
  @Get('complaints/my') @Header('Cache-Control','no-store, private')
  mine(@Request() req: CareerRequest, @Query() page: CareerMyComplaintPageDto) { return this.moderation.complaints(req.user,page,true); }
  @Get('moderation/complaints') @Header('Cache-Control','no-store, private')
  complaints(@Request() req: CareerRequest, @Query() page: CareerModerationPageDto) { return this.moderation.complaints(req.user,page); }
  @Post('moderation/complaints/:id/decision') @Header('Cache-Control','no-store, private')
  resolve(@Request() req: CareerRequest, @Param('id',ParseUUIDPipe) id: string, @Body() dto: CareerComplaintDecisionDto) { return this.moderation.resolve(req.user,id,dto); }
}
