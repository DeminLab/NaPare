import { BadRequestException, Controller, Get, Query, Request, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EventBusService } from './event-bus.service';
import { EventStreamMessage } from './event.types';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventBus: EventBusService) {}

  @Get()
  async list(@Request() req, @Query('since') since?: string) {
    return this.eventBus.listSince(
      req.user.id,
      req.user.universityId,
      parseSince(since),
    );
  }

  @Sse('stream')
  stream(@Request() req, @Query('since') since?: string): Observable<EventStreamMessage> {
    return this.eventBus.stream(
      req.user.id,
      req.user.universityId,
      parseSince(since),
    );
  }
}

function parseSince(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('since must be a valid ISO timestamp');
  return date;
}
