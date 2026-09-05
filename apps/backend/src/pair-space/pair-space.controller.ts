import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { PairSpaceService } from './pair-space.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('pair-space')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pair-space')
export class PairSpaceController {
  constructor(private readonly pairSpaceService: PairSpaceService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Получить PairSpace по ID' })
  async findOne(@Param('id') id: string) {
    return this.pairSpaceService.findById(id);
  }

  @Get('lesson/:lessonId')
  @ApiOperation({ summary: 'Получить PairSpace по уроку' })
  async findByLesson(@Param('lessonId') lessonId: string) {
    return this.pairSpaceService.findByLesson(lessonId);
  }

  @Post(':id/announcements')
  @ApiOperation({ summary: 'Создать объявление' })
  async createAnnouncement(
    @Param('id') id: string,
    @Request() req,
    @Body() createAnnouncementDto: CreateAnnouncementDto,
  ) {
    return this.pairSpaceService.createAnnouncement(
      id,
      req.user.id,
      createAnnouncementDto,
    );
  }

  @Get(':id/announcements')
  @ApiOperation({ summary: 'Получить объявления' })
  async getAnnouncements(@Param('id') id: string) {
    return this.pairSpaceService.getAnnouncements(id);
  }

  @Post(':id/homeworks')
  @ApiOperation({ summary: 'Создать домашнее задание' })
  async createHomework(
    @Param('id') id: string,
    @Request() req,
    @Body() createHomeworkDto: CreateHomeworkDto,
  ) {
    return this.pairSpaceService.createHomework(
      id,
      req.user.id,
      createHomeworkDto,
    );
  }

  @Get(':id/homeworks')
  @ApiOperation({ summary: 'Получить домашние задания' })
  async getHomeworks(@Param('id') id: string) {
    return this.pairSpaceService.getHomeworks(id);
  }

  @Post('homeworks/:homeworkId/complete')
  @ApiOperation({ summary: 'Отметить домашнее задание как выполненное' })
  async completeHomework(@Param('homeworkId') homeworkId: string) {
    return this.pairSpaceService.completeHomework(homeworkId);
  }
}
