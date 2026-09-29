import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

import { AuthService } from "./auth.service";
import { AppConfig } from "../config/configuration";

@Controller("integrations/telegram")
export class TelegramWebhookController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppConfig & Record<string, unknown>>,
  ) {}

  @Post("webhook")
  async receiveUpdate(
    @Headers("x-telegram-bot-api-secret-token") suppliedSecret: string | undefined,
    @Body() update: unknown,
  ): Promise<{ ok: true }> {
    const expectedSecret = this.configService.get<string>("telegram.webhookSecret") ?? "";
    if (!expectedSecret || !suppliedSecret) throw new UnauthorizedException();
    const expected = Buffer.from(expectedSecret);
    const supplied = Buffer.from(suppliedSecret);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedException();
    }
    await this.authService.handleTelegramWebhook(update);
    return { ok: true };
  }
}
