import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { InvitesService } from './invites.service';
import { ClaimInviteDto } from './dto/claim-invite.dto';
import { TelemetryRequestContext } from '../telemetry/telemetry.service';
import { clientFromHeader } from '../telemetry/user-agent';

type PublicRequest = { ip?: string; get?(name: string): string | undefined };

function requestContext(request: PublicRequest): TelemetryRequestContext {
  const userAgent = request.get?.('user-agent') ?? null;
  return {
    ip: request.ip ?? null,
    userAgent,
    client: clientFromHeader(request.get?.('x-napare-client'), userAgent),
  };
}

/**
 * TZ 9.2 public boundary: invite lookup and claim. Both routes are public;
 * the harder per-route throttle is the TZ `public*` marker (SEC-09) and the
 * claim body carries its own attempt limit.
 */
@ApiTags('invites')
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Данные приглашения по токену: организация, группа, срок' })
  @ApiResponse({ status: 200, description: 'Публичные данные приглашения' })
  @ApiResponse({ status: 404, description: 'Приглашение не найдено, использовано или просрочено' })
  lookup(@Param('token') token: string) {
    return this.invites.getPublicInvite(token);
  }

  @Post(':token/claim')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Привязка по введённым данным и второму фактору; без раскрытия списка людей' })
  @ApiResponse({ status: 200, description: 'Привязка выполнена, возвращены токены сессии' })
  @ApiResponse({ status: 404, description: 'Единый ответ «нет такого» и «неверный фактор»' })
  @ApiResponse({ status: 429, description: 'Лимит попыток: LINK_ATTEMPTS_EXCEEDED' })
  claim(
    @Param('token') token: string,
    @Body() dto: ClaimInviteDto,
    @Request() request: PublicRequest,
  ) {
    return this.invites.claim(token, dto, requestContext(request));
  }
}
