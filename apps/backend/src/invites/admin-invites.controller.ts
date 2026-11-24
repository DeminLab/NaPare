import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';

/**
 * FR-STF-04 staff surface: manage personal invites. Scope is the verified
 * JWT actor's organization; the shareable token is returned only when it is
 * created or regenerated (FR-ONB-02).
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/invites')
export class AdminInvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Список приглашений организации' })
  list(@Request() req) {
    return this.invites.listInvites(req.user);
  }

  @Post()
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Создать приглашение: в ответе однократно возвращается токен ссылки' })
  create(@Request() req, @Body() dto: CreateInviteDto) {
    return this.invites.createInvite(req.user, dto);
  }

  @Post(':id/regenerate')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.DEVELOPER, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Перегенерировать токен и срок приглашения' })
  regenerate(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.regenerateInvite(req.user, id);
  }
}
