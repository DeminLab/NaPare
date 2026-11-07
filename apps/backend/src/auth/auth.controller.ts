import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
  GoneException,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Throttle } from "@nestjs/throttler";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { MaxAuthDto } from "./dto/max-auth.dto";
import { MaxLinkDto } from "./dto/max-link.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RevokeOwnSessionDto } from "./dto/revoke-session.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { University } from "../users/entities/university.entity";
import { RaspScraperService, SIBIT_UNIVERSITY } from "./rasp-scraper.service";
import { clientFromHeader } from "../telemetry/user-agent";

type AuthRequest = { user: { id: string; sessionId?: string }; ip?: string; get?(name: string): string | undefined };

function requestContext(request: AuthRequest) {
  const userAgent = request.get?.("user-agent") ?? null;
  return {
    ip: request.ip ?? null,
    userAgent,
    client: clientFromHeader(request.get?.("x-napare-client"), userAgent),
  };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(University)
    private readonly universitiesRepository: Repository<University>,
    private readonly raspScraperService: RaspScraperService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: "Вход в систему" })
  @ApiResponse({ status: 200, description: "Успешный вход" })
  @ApiResponse({ status: 401, description: "Неверные учетные данные" })
  async login(@Body() loginDto: LoginDto, @Request() req: AuthRequest) {
    return this.authService.login(loginDto, requestContext(req));
  }

  @Post("max")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: "Вход через MAX Mini App (валидация initData)" })
  @ApiResponse({
    status: 200,
    description: "Успешный вход или привязка аккаунта",
  })
  @ApiResponse({
    status: 401,
    description: "Неверные данные MAX, аккаунт не привязан",
  })
  @ApiResponse({
    status: 409,
    description: "Аккаунт MAX уже привязан к другому пользователю",
  })
  @ApiResponse({
    status: 503,
    description: "MAX не настроен (нет MAX_BOT_TOKEN)",
  })
  async maxAuth(@Body() maxAuthDto: MaxAuthDto, @Request() req: AuthRequest) {
    return this.authService.maxAuth(maxAuthDto, requestContext(req));
  }

  @Post("max/link")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Привязать MAX к аккаунту текущей сессии" })
  async linkMaxToCurrentUser(@Body() dto: MaxLinkDto, @Request() req: AuthRequest) {
    return this.authService.linkMaxToAuthenticatedUser(dto.initData, req.user.id, requestContext(req));
  }

  @Get("max/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получить состояние привязки MAX текущего аккаунта" })
  async getMaxLinkStatus(@Request() req) {
    return this.authService.getMaxLinkStatus(req.user.id);
  }

  @Post("telegram/link")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Создать одноразовую ссылку для привязки Telegram" })
  async createTelegramLink(@Request() req) {
    throw new GoneException('Telegram больше не используется в NaPare');
  }

  @Get("telegram/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Получить состояние привязки Telegram" })
  async getTelegramLinkStatus(@Request() req) {
    return { linked: false, notificationsConfigured: false, available: false };
  }

  @Post("portal-login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: "Единый вход в кабинеты NaPare" })
  @ApiResponse({
    status: 200,
    description: "Вход выполнен, определён кабинет пользователя",
  })
  @ApiResponse({ status: 401, description: "Неверные учетные данные" })
  @ApiResponse({ status: 403, description: "Для роли не настроен кабинет" })
  async portalLogin(@Body() loginDto: LoginDto, @Request() req: AuthRequest) {
    return this.authService.portalLogin(loginDto, requestContext(req));
  }

  @Post("register")
  @HttpCode(HttpStatus.FORBIDDEN)
  @ApiOperation({ summary: "Самостоятельная регистрация отключена" })
  @ApiResponse({
    status: 403,
    description: "Новые аккаунты создаёт университет",
  })
  register(): never {
    throw new ForbiddenException(
      "Самостоятельная регистрация отключена. Получите готовые учётные данные в университете.",
    );
  }

  @Get("universities")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Список активных университетов (публичный)" })
  async getUniversities() {
    return this.universitiesRepository.find({
      where: {
        status: "active",
        name: SIBIT_UNIVERSITY.name,
        city: SIBIT_UNIVERSITY.city,
      },
      select: ["id", "name", "city"],
    });
  }

  @Get("rasp-groups")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Список групп с rasp.sano.ru (публичный)" })
  async getRaspGroups(@Query("year") year?: string) {
    return this.raspScraperService.getGroups(year);
  }

  @Get("rasp-years")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Учебные годы с rasp.sano.ru (публичный)" })
  async getRaspYears() {
    return this.raspScraperService.getYears();
  }

  @Get("rasp-schedule")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Расписание группы с rasp.sano.ru (публичный)" })
  async getRaspSchedule(
    @Query("groupId") groupId: string,
    @Query("year") year?: string,
  ) {
    return this.raspScraperService.getSchedule(groupId, year);
  }

  @Get("rasp-catalog")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Полный каталог СИБИТа с rasp.sano.ru (публичный)" })
  async getRaspCatalog(@Query("year") year?: string) {
    return this.raspScraperService.getCatalog(year);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Обновление токена" })
  @ApiResponse({ status: 200, description: "Токен обновлен" })
  @ApiResponse({ status: 401, description: "Неверный токен" })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Выход из системы" })
  @ApiResponse({ status: 200, description: "Успешный выход" })
  async logout(@Request() req: AuthRequest) {
    await this.authService.logout(req.user.id, requestContext(req));
    return { success: true };
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Сессии текущего аккаунта на устройствах" })
  async sessions(@Request() req: AuthRequest) {
    const data = await this.authService.sessions(req.user.id);
    return { data, currentSessionId: req.user.sessionId ?? null };
  }

  @Post("sessions/:id/revoke")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Завершить выбранную сессию текущего аккаунта" })
  async revokeSession(@Param("id", ParseUUIDPipe) id: string, @Body() dto: RevokeOwnSessionDto, @Request() req: AuthRequest) {
    const changed = await this.authService.revokeOwnSession(req.user.id, id, requestContext(req), dto.reason);
    return { changed, current: id === req.user.sessionId };
  }
}
