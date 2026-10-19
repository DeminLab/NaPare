import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAttachmentActionDto, PlatformAttachmentQueryDto } from './platform-attachments.dto';
import { PlatformAttachmentsService } from './platform-attachments.service';

@ApiTags('platform-attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform-attachments')
export class PlatformAttachmentsController {
  constructor(private readonly attachments: PlatformAttachmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Глобальный поиск метаданных вложений PairSpace' })
  list(@Query() query: PlatformAttachmentQueryDto, @Req() request: Request) {
    return this.attachments.list(query, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Просмотр метаданных и состояния вложения PairSpace' })
  detail(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.attachments.detail(id, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Обратимо скрыть ссылку на вложение PairSpace' })
  revoke(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAttachmentActionDto, @Req() request: Request) {
    return this.attachments.revoke(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Восстановить ссылку на вложение PairSpace' })
  restore(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PlatformAttachmentActionDto, @Req() request: Request) {
    return this.attachments.restore(id, dto, { ip: request.ip, userAgent: request.get('user-agent') });
  }
}
