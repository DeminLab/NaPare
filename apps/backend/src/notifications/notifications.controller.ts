import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaginatedResponseDto, PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { SnoozeInboxItemDto } from './dto/snooze-inbox-item.dto';
import { InboxItemStatus, INBOX_ITEM_STATUSES } from './entities/inbox-item.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить уведомления пользователя' })
  @ApiOkResponse({ description: 'Уведомления получены', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req, @Query() pagination: PaginationQueryDto) {
    return this.notificationsService.findByUser(req.user.id, pagination);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Получить количество непрочитанных уведомлений' })
  @ApiResponse({ status: 200, description: 'Количество получено' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Отметить уведомление как прочитанное' })
  @ApiResponse({ status: 200, description: 'Уведомление отмечено как прочитанное' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Отметить все уведомления как прочитанные' })
  @ApiResponse({ status: 200, description: 'Все уведомления отмечены как прочитанные' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Get('preferences')
  async getPreferences(@Request() req) {
    return this.notificationsService.getPreferences(req.user.id, req.user.universityId);
  }

  @Patch('preferences')
  async updatePreferences(@Request() req, @Body() update: UpdateNotificationPreferenceDto) {
    return this.notificationsService.updatePreferences(req.user.id, req.user.universityId, update);
  }

  @Get('inbox')
  async getInbox(
    @Request() req,
    @Query('status') status?: InboxItemStatus,
    @Query('limit') limit?: string,
  ) {
    const safeStatus = status && INBOX_ITEM_STATUSES.includes(status) ? status : undefined;
    return this.notificationsService.findInbox(req.user.id, safeStatus, limit ? Number(limit) : undefined);
  }

  @Patch('inbox/:id/complete')
  async completeInboxItem(@Request() req, @Param('id') id: string) {
    await this.notificationsService.completeInboxItem(req.user.id, id);
  }

  @Patch('inbox/:id/snooze')
  async snoozeInboxItem(
    @Request() req,
    @Param('id') id: string,
    @Body() body: SnoozeInboxItemDto,
  ) {
    await this.notificationsService.snoozeInboxItem(req.user.id, id, new Date(body.until));
  }

}
