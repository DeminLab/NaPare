import { Body, Controller, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { ClientTelemetryBatchDto } from './telemetry.dto';
import { TelemetryCategory, TelemetrySeverity } from './telemetry.entities';
import { TelemetryService } from './telemetry.service';

type TelemetryRequest = {
  user?: AuthenticatedUser;
  ip?: string;
  get(name: string): string | undefined;
};

@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({ summary: 'Принять пакет обезличенных клиентских событий' })
  async events(@Body() dto: ClientTelemetryBatchDto, @Request() request: TelemetryRequest) {
    const userAgent = request.get('user-agent') ?? null;
    const source = this.telemetry.clientFrom(request.get('x-napare-client'), userAgent);
    const user = request.user;
    for (const event of dto.events) {
      const category: TelemetryCategory = event.name.startsWith('error.') ? 'error' : 'ui';
      const severity: TelemetrySeverity = event.name.startsWith('error.') ? 'error' : 'info';
      this.telemetry.enqueueEvent({
        source,
        category,
        name: event.name,
        severity,
        userId: user?.id ?? null,
        universityId: user?.universityId ?? null,
        sessionId: user?.sessionId ?? null,
        path: event.path ?? null,
        ip: request.ip ?? null,
        userAgent,
        metadata: {
          app: dto.app ?? null,
          installId: dto.installId ?? null,
          ...(event.metadata ?? {}),
        },
      });
    }
    return { accepted: dto.events.length };
  }
}
