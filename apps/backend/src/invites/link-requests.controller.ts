import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { InvitesService } from './invites.service';
import { CreateLinkRequestDto } from './dto/create-link-request.dto';

/**
 * TZ 9.2 public*: FR-ONB-04 fallback — a student whose claim failed sends a
 * linkage request that staff approves or rejects from the queue.
 */
@ApiTags('link-requests')
@Controller('link-requests')
export class LinkRequestsController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Заявка на привязку при неудаче попытки привязки' })
  @ApiResponse({ status: 201, description: 'Заявка принята в очередь (ответ одинаков, независимо от наличия аккаунта)' })
  create(@Body() dto: CreateLinkRequestDto) {
    return this.invites.createLinkRequest(dto);
  }
}
