import {
  Controller,
  Delete,
  Post,
  Get,
  Header,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDeviceTokenDto } from '../notifications/dto/register-device-token.dto';
import { RemoveDeviceTokenDto } from '../notifications/dto/remove-device-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WebPushClientService } from './webpush-client.service';
import { WebPushConsentDto, WebPushTokenDto } from './dto/webpush-consent.dto';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly notificationsService: NotificationsService, private readonly webPush: WebPushClientService) {}

  @Get('webpush') @Header('Cache-Control', 'private, no-store')
  webPushStatus() { return this.webPush.status(); }
  @Post('webpush') @Header('Cache-Control', 'private, no-store')
  registerWebPush(@Body() dto: WebPushConsentDto) { return this.webPush.register(dto); }
  @Delete('webpush') @Header('Cache-Control', 'private, no-store')
  revokeWebPush(@Body() dto: WebPushTokenDto) { return this.webPush.revoke(dto.token); }

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
      registerDeviceTokenDto.provider,
    );
  }

  @Delete('token')
  @ApiOperation({ summary: 'Удалить токен текущего устройства' })
  @ApiResponse({ status: 200, description: 'Токен удалён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeToken(@Body() removeDeviceTokenDto: RemoveDeviceTokenDto) {
    return this.notificationsService.removeDeviceToken(removeDeviceTokenDto.token);
  }
}
