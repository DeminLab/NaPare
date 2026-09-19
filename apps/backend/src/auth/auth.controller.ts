import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Query, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { University } from '../users/entities/university.entity';
import { RaspScraperService, SIBIT_UNIVERSITY } from './rasp-scraper.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(University)
    private readonly universitiesRepository: Repository<University>,
    private readonly raspScraperService: RaspScraperService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход в систему' })
  @ApiResponse({ status: 200, description: 'Успешный вход' })
  @ApiResponse({ status: 401, description: 'Неверные учетные данные' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('portal-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Единый вход в кабинеты NaPare' })
  @ApiResponse({ status: 200, description: 'Вход выполнен, определён кабинет пользователя' })
  @ApiResponse({ status: 401, description: 'Неверные учетные данные' })
  @ApiResponse({ status: 403, description: 'Роль использует отдельный вход' })
  async portalLogin(@Body() loginDto: LoginDto) {
    return this.authService.portalLogin(loginDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.FORBIDDEN)
  @ApiOperation({ summary: 'Самостоятельная регистрация отключена' })
  @ApiResponse({ status: 403, description: 'Новые аккаунты создаёт университет' })
  register(): never {
    throw new ForbiddenException('Самостоятельная регистрация отключена. Получите готовые учётные данные в университете.');
  }

  @Get('universities')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Список активных университетов (публичный)' })
  async getUniversities() {
    return this.universitiesRepository.find({
      where: { status: 'active', name: SIBIT_UNIVERSITY.name, city: SIBIT_UNIVERSITY.city },
      select: ['id', 'name', 'city'],
    });
  }

  @Get('rasp-groups')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Список групп с rasp.sano.ru (публичный)' })
  async getRaspGroups(@Query('year') year?: string) {
    return this.raspScraperService.getGroups(year);
  }

  @Get('rasp-years')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Учебные годы с rasp.sano.ru (публичный)' })
  async getRaspYears() {
    return this.raspScraperService.getYears();
  }

  @Get('rasp-schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Расписание группы с rasp.sano.ru (публичный)' })
  async getRaspSchedule(@Query('groupId') groupId: string, @Query('year') year?: string) {
    return this.raspScraperService.getSchedule(groupId, year);
  }

  @Get('rasp-catalog')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Полный каталог СИБИТа с rasp.sano.ru (публичный)' })
  async getRaspCatalog(@Query('year') year?: string) {
    return this.raspScraperService.getCatalog(year);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновление токена' })
  @ApiResponse({ status: 200, description: 'Токен обновлен' })
  @ApiResponse({ status: 401, description: 'Неверный токен' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Выход из системы' })
  @ApiResponse({ status: 200, description: 'Успешный выход' })
  async logout() {
    return { success: true };
  }
}
