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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить уведомления пользователя' })
  async findAll(@Request() req) {
    return this.notificationsService.findByUser(req.user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Получить количество непрочитанных уведомлений' })
  async getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Отметить уведомление как прочитанное' })
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Отметить все уведомления как прочитанные' })
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Post('device-token')
  @ApiOperation({ summary: 'Зарегистрировать токен устройства' })
  async registerDeviceToken(
    @Request() req,
    @Body() registerDeviceTokenDto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(
      req.user.id,
      registerDeviceTokenDto.token,
      registerDeviceTokenDto.platform,
      registerDeviceTokenDto.deviceName,
    );
  }

  @Post('device-token/remove')
  @ApiOperation({ summary: 'Удалить токен устройства' })
  async removeDeviceToken(@Body('token') token: string) {
    return this.notificationsService.removeDeviceToken(token);
  }
}
