import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { PairSpaceService } from './pair-space.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateFileDto } from './dto/create-file.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('pair-spaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pair-spaces')
export class PairSpaceController {
  constructor(private readonly pairSpaceService: PairSpaceService) {}

  @Get(':lessonId')
  @ApiOperation({ summary: 'Получить PairSpace по уроку' })
  @ApiResponse({ status: 200, description: 'PairSpace найден' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findByLesson(@Param('lessonId') lessonId: string) {
    return this.pairSpaceService.findByLesson(lessonId);
  }

  @Post(':lessonId/announcements')
  @ApiOperation({ summary: 'Создать объявление' })
  @ApiResponse({ status: 201, description: 'Объявление создано' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createAnnouncement(
    @Param('lessonId') lessonId: string,
    @Request() req,
    @Body() createAnnouncementDto: CreateAnnouncementDto,
  ) {
    const pairSpace = await this.pairSpaceService.findByLesson(lessonId);
    return this.pairSpaceService.createAnnouncement(
      pairSpace.id,
      req.user.id,
      createAnnouncementDto,
    );
  }

  @Post(':lessonId/homeworks')
  @ApiOperation({ summary: 'Создать домашнее задание' })
  @ApiResponse({ status: 201, description: 'Домашнее задание создано' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createHomework(
    @Param('lessonId') lessonId: string,
    @Request() req,
    @Body() createHomeworkDto: CreateHomeworkDto,
  ) {
    const pairSpace = await this.pairSpaceService.findByLesson(lessonId);
    return this.pairSpaceService.createHomework(
      pairSpace.id,
      req.user.id,
      createHomeworkDto,
    );
  }

  @Post(':lessonId/files')
  @ApiOperation({ summary: 'Загрузить файл' })
  @ApiResponse({ status: 201, description: 'Файл загружен' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadFile(
    @Param('lessonId') lessonId: string,
    @Request() req,
    @Body() createFileDto: CreateFileDto,
  ) {
    const pairSpace = await this.pairSpaceService.findByLesson(lessonId);
    return this.pairSpaceService.uploadFile(
      pairSpace.id,
      req.user.id,
      createFileDto,
    );
  }

  @Get(':lessonId/messages')
  @ApiOperation({ summary: 'Получить сообщения обсуждения' })
  @ApiResponse({ status: 200, description: 'Сообщения получены' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessages(@Param('lessonId') lessonId: string) {
    const pairSpace = await this.pairSpaceService.findByLesson(lessonId);
    return this.pairSpaceService.getMessages(pairSpace.id);
  }

  @Post(':lessonId/messages')
  @ApiOperation({ summary: 'Отправить сообщение' })
  @ApiResponse({ status: 201, description: 'Сообщение отправлено' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createMessage(
    @Param('lessonId') lessonId: string,
    @Request() req,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const pairSpace = await this.pairSpaceService.findByLesson(lessonId);
    return this.pairSpaceService.createMessage(
      pairSpace.id,
      req.user.id,
      createMessageDto,
    );
  }

  @Patch('homeworks/:id/submit')
  @ApiOperation({ summary: 'Сдать домашнее задание' })
  @ApiResponse({ status: 200, description: 'Домашнее задание сдано' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async submitHomework(
    @Param('id') id: string,
    @Request() req,
    @Body() submitHomeworkDto: SubmitHomeworkDto,
  ) {
    return this.pairSpaceService.submitHomework(
      id,
      req.user.id,
      submitHomeworkDto,
    );
  }
}
