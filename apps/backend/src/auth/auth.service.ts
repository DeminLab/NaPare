import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";

import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { MaxAuthDto } from "./dto/max-auth.dto";
import { AuthResponse } from "./interfaces/auth-response.interface";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { AppConfig } from "../config/configuration";
import { UserRole } from "./interfaces/user-role";
import { User } from "../users/entities/user.entity";
import { validateMaxInitData } from "./max-init-data";
import { TenantContext } from '../common/tenant/tenant-context';

export type PortalWorkspace = "student" | "staff" | "admin" | "developer" | "career";

@Injectable()
export class AuthService {
  private readonly telegramLinkTtlMs = 10 * 60 * 1000;
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<
      AppConfig & Record<string, unknown>
    >,
    private readonly tenant: TenantContext = new TenantContext(),
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.tenant.runWithDatabaseAccess(
      { authentication: { email: loginDto.email.trim() } },
      () => this.usersService.findByEmail(loginDto.email.trim()),
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.generateTokens(user);
  }

  async portalLogin(
    loginDto: LoginDto,
  ): Promise<AuthResponse & { workspace: PortalWorkspace }> {
    const response = await this.login(loginDto);
    const workspace = this.getPortalWorkspace(response.user.role);

    if (!workspace) {
      throw new ForbiddenException(
        "Для этой роли пока не настроен доступ к кабинету.",
      );
    }

    return { ...response, workspace };
  }

  async maxAuth(maxAuthDto: MaxAuthDto): Promise<AuthResponse> {
    const botToken = this.configService.get<string>("max.botToken") ?? "";
    if (!botToken) {
      throw new ServiceUnavailableException({
        code: "MAX_NOT_CONFIGURED",
        message: "Вход через MAX не настроен: задайте MAX_BOT_TOKEN",
      });
    }

    if (Boolean(maxAuthDto.email) !== Boolean(maxAuthDto.password)) {
      throw new BadRequestException(
        "Email и password должны указываться вместе",
      );
    }

    const maxAgeSeconds = Number(
      this.configService.get("max.initDataTtlSeconds") ?? 900,
    );
    const payload = validateMaxInitData(maxAuthDto.initData, botToken, {
      maxAgeSeconds,
    });
    if (!payload) {
      throw new UnauthorizedException({
        code: "MAX_INVALID_INIT_DATA",
        message: "Данные входа MAX недействительны или устарели",
      });
    }

    let user = await this.tenant.runWithDatabaseAccess(
      { authentication: { maxUserId: payload.maxUserId } },
      () => this.usersService.findByMaxUserId(payload.maxUserId),
    );

    if (!user) {
      if (!maxAuthDto.email || !maxAuthDto.password) {
        throw new UnauthorizedException({
          code: "MAX_ACCOUNT_NOT_LINKED",
          message:
            "Аккаунт MAX не привязан. Войдите по email и паролю, чтобы привязать его.",
        });
      }

      user = await this.linkMaxAccount(
        payload.maxUserId,
        maxAuthDto.email.trim(),
        maxAuthDto.password,
      );
      if (!user) {
        throw new UnauthorizedException({
          code: "MAX_INVALID_CREDENTIALS",
          message: "Неверный email или пароль",
        });
      }
    }

    if (!user.isActive) {
      throw new ForbiddenException("Аккаунт деактивирован");
    }

    return this.generateTokens(user);
  }

  async linkMaxToAuthenticatedUser(initData: string, userId: string): Promise<AuthResponse> {
    const botToken = this.configService.get<string>("max.botToken") ?? "";
    if (!botToken) {
      throw new ServiceUnavailableException({
        code: "MAX_NOT_CONFIGURED",
        message: "Вход через MAX не настроен: задайте MAX_BOT_TOKEN",
      });
    }

    const maxAgeSeconds = Number(
      this.configService.get("max.initDataTtlSeconds") ?? 900,
    );
    const payload = validateMaxInitData(initData, botToken, { maxAgeSeconds });
    if (!payload) {
      throw new UnauthorizedException({
        code: "MAX_INVALID_INIT_DATA",
        message: "Данные входа MAX недействительны или устарели",
      });
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Аккаунт недоступен");
    }
    const alreadyLinked = await this.tenant.runWithDatabaseAccess(
      { authentication: { maxUserId: payload.maxUserId } },
      () => this.usersService.findByMaxUserId(payload.maxUserId),
    );
    if (alreadyLinked && alreadyLinked.id !== userId) {
      throw new ConflictException("Этот аккаунт MAX уже привязан к другому пользователю");
    }

    try {
      const linkedUser = await this.usersService.bindMaxUserIdIfUnlinked(userId, payload.maxUserId);
      return this.generateTokens(linkedUser);
    } catch (error) {
      const driverCode = (error as { driverError?: { code?: string } })?.driverError?.code;
      if (driverCode === "23505") {
        throw new ConflictException("Этот аккаунт MAX уже привязан к другому пользователю");
      }
      throw error;
    }
  }

  async getMaxLinkStatus(userId: string): Promise<{ linked: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Аккаунт недоступен");
    }
    return { linked: Boolean(user.maxUserId) };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>("auth.jwt.refreshSecret"),
      });

      const user = await this.tenant.runWithDatabaseAccess(
        { authentication: { id: payload.sub } },
        () => this.usersService.findById(payload.sub),
      );

      if (
        !user ||
        !user.isActive ||
        user.role !== payload.role ||
        user.sessionVersion !== payload.sessionVersion
      ) {
        throw new UnauthorizedException("User not found");
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.invalidateSessions(userId);
  }

  async createTelegramLink(userId: string): Promise<{ botLink: string; expiresAt: string }> {
    const botToken = this.configService.get<string>("telegram.botToken") ?? "";
    const botUsername = this.configService.get<string>("telegram.botUsername") ?? "";
    if (!botToken || !botUsername) {
      throw new ServiceUnavailableException({
        code: "TELEGRAM_NOT_CONFIGURED",
        message: "Привязка Telegram пока не настроена",
      });
    }

    const code = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + this.telegramLinkTtlMs);
    await this.usersService.createTelegramLinkChallenge(
      userId,
      createHash("sha256").update(code).digest("hex"),
      expiresAt,
    );
    return {
      botLink: `https://t.me/${botUsername}?start=${code}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getTelegramLinkStatus(userId: string): Promise<{ linked: boolean; notificationsConfigured: boolean }> {
    return {
      linked: await this.usersService.isTelegramLinked(userId),
      notificationsConfigured: Boolean(
        this.configService.get<string>('telegram.botToken')
        && this.configService.get<string>('telegram.botUsername')
        && this.configService.get<string>('telegram.webhookSecret')
        && this.configService.get<string>('telegram.publicAppUrl'),
      ),
    };
  }

  async handleTelegramWebhook(update: unknown): Promise<void> {
    const botToken = this.configService.get<string>("telegram.botToken") ?? "";
    if (!botToken || !this.configService.get<string>("telegram.webhookSecret")) {
      throw new ServiceUnavailableException("Telegram webhook is not configured");
    }
    if (!update || typeof update !== "object") return;
    const message = (update as { message?: { text?: unknown; from?: { id?: unknown }; chat?: { id?: unknown; type?: unknown } } }).message;
    const codeMatch = typeof message?.text === "string"
      ? /^\/(?:start|link)(?:@\w+)?\s+([A-Za-z0-9_-]{32})\s*$/.exec(message.text.trim())
      : null;
    if (!codeMatch || message?.chat?.type !== "private"
      || !Number.isSafeInteger(message.from?.id) || !Number.isSafeInteger(message.chat.id)) return;

    const result = await this.usersService.consumeTelegramLinkChallenge(
      createHash("sha256").update(codeMatch[1]).digest("hex"),
      String(message.from!.id),
    );
    const reply = result === "linked"
      ? "Telegram привязан к вашему аккаунту НаПаре. Для MAX используйте кнопку открытия сайта внутри MAX — эти связи подтверждаются отдельно."
      : result === "already-linked"
        ? "Этот аккаунт NaPare или Telegram уже привязан к другой учётной записи. Войдите в нужный аккаунт сайта и создайте новую ссылку."
        : "Ссылка недействительна или истекла. Создайте новую ссылку в профиле НаПаре.";
    await this.sendTelegramMessage(botToken, message.chat.id as number, reply);
  }

  private async sendTelegramMessage(botToken: string, chatId: number, text: string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Linking is committed before sending the confirmation; do not let a
      // transient Telegram API outage cause Telegram to replay the webhook.
    }
  }

  private async linkMaxAccount(
    maxUserId: string,
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.tenant.runWithDatabaseAccess(
      { authentication: { email } },
      () => this.usersService.findByEmail(email),
    );

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    try {
      return await this.tenant.runWithDatabaseAccess(
        { authentication: { id: user.id, write: true } },
        () => this.usersService.bindMaxUserIdIfUnlinked(user.id, maxUserId),
      );
    } catch (error) {
      const driverCode = (error as { driverError?: { code?: string } })
        ?.driverError?.code;
      if (driverCode === "23505") {
        throw new ConflictException(
          "Этот аккаунт MAX уже привязан к другому пользователю",
        );
      }
      throw error;
    }
  }

  private generateTokens(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      universityId: user.universityId,
      groupId: user.groupId,
      sessionVersion: user.sessionVersion ?? 0,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>("auth.jwt.refreshSecret"),
      expiresIn: this.configService.getOrThrow<string>(
        "auth.jwt.refreshExpiration",
      ),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  private getPortalWorkspace(role: UserRole): PortalWorkspace | null {
    if ([UserRole.EMPLOYER, UserRole.CAREER_STAFF, UserRole.CAREER_ADMIN].includes(role)) return "career";
    if (role === UserRole.STUDENT) return "student";
    if (role === UserRole.DEVELOPER) return "developer";
    if (
      [
        UserRole.TEACHER,
        UserRole.CURATOR,
        UserRole.FACULTY_DEAN,
        UserRole.DEPARTMENT_HEAD,
      ].includes(role)
    )
      return "staff";
    if ([UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN].includes(role))
      return "admin";
    return null;
  }
}
