import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  Res,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { BindGroupDto } from './dto/bind-group.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from './entities/user.entity';
import { Response } from 'express';
import { PersonalDataService } from './personal-data.service';
import { AccountErasureService } from './account-erasure.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService, private readonly personalData: PersonalDataService, private readonly erasure: AccountErasureService) {}

  @Get('me/deletion-preview')
  @Header('Cache-Control', 'no-store, private')
  @ApiOperation({ summary: 'Что будет удалено и что останется в учебном архиве' })
  async deletionPreview() { return this.erasure.preview(); }

  @Get('me/export')
  @ApiOperation({ summary: 'Скачать JSON-экспорт собственных персональных данных' })
  @ApiResponse({ status: 200, description: 'JSON текущего снимка БД с описанием исключений' })
  async exportProfile(@Res() response: Response) {
    await this.personalData.download(response);
  }

  @Get('me')
  @ApiOperation({ summary: 'Получить профиль текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Профиль пользователя получен' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req) {
    return this.toProfileResponse(await this.usersService.findById(req.user.id));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Обновить профиль текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Профиль обновлён' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.toProfileResponse(await this.usersService.update(req.user.id, updateUserDto));
  }

  @Delete('me')
  @Header('Cache-Control', 'no-store, private')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Удалить аккаунт текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Доступ и личный профиль удалены; учебный архив сохранён под кодом' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAccount(@Body() dto: DeleteAccountDto) { return this.erasure.erase(dto); }

  @Post('me/bind-group')
  @ApiOperation({ summary: 'Привязать пользователя к группе' })
  @ApiResponse({ status: 200, description: 'Пользователь привязан к группе' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bindGroup(
    @Request() req,
    @Body() bindGroupDto: BindGroupDto,
  ) {
    return this.toProfileResponse(await this.usersService.bindGroup(req.user.id, bindGroupDto.groupId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить пользователя по ID' })
  @ApiResponse({ status: 200, description: 'Пользователь найден' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findById(@Param('id') id: string, @Request() req) {
    if (id !== req.user.id) {
      throw new ForbiddenException('Можно просматривать только собственный профиль.');
    }
    return this.toProfileResponse(await this.usersService.findById(id));
  }

  private toProfileResponse(user: User | null) {
    if (!user) throw new NotFoundException('Профиль не найден.');
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      universityId: user.universityId,
      groupId: user.groupId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
