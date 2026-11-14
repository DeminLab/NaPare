import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { InvitesService } from './invites.service';
import { DecideLinkRequestDto } from './dto/decide-link-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/interfaces/user-role';

/**
 * FR-STF-04 / FR-ONB-04 staff surface: the queue of linkage requests with
 * approve/reject transitions; scope is the verified JWT actor's organization.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/link-requests')
export class AdminLinkRequestsController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Очередь заявок на привязку организации' })
  list(@Request() req) {
    return this.invites.listLinkRequests(req.user);
  }

  @Patch(':id')
  @Roles(UserRole.UNIVERSITY_ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Одобрить или отклонить заявку на привязку' })
  decide(@Request() req, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLinkRequestDto) {
    return this.invites.decideLinkRequest(req.user, id, dto);
  }
}
