import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformHomeworkSubmissionPatchDto, PlatformHomeworkSubmissionQueryDto } from './platform-homework.dto';
import { PlatformHomeworkService } from './platform-homework.service';

@ApiTags('platform-homework')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-homework')
export class PlatformHomeworkController {
  constructor(private readonly homework: PlatformHomeworkService) {}

  @Get('submissions')
  @ApiOperation({ summary: 'Глобальный поиск сдач домашних заданий' })
  submissions(@Query() query: PlatformHomeworkSubmissionQueryDto, @Req() request: Request) {
    return this.homework.submissions(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Просмотреть содержимое сдачи с аудитом' })
  submission(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.homework.submission(id, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Patch('submissions/:id')
  @ApiOperation({ summary: 'Исправить сдачу домашнего задания с обязательной причиной' })
  patchSubmission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformHomeworkSubmissionPatchDto, @Req() request: Request) {
    return this.homework.patchSubmission(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }
}
