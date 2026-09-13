import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDeviceTokenDto } from '../notifications/dto/register-device-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('token')
  @ApiOperation({ summary: 'Зарегистрировать токен устройства' })
  @ApiResponse({ status: 201, description: 'Токен зарегистрирован' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async registerToken(
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
}
