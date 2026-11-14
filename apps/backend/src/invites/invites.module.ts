import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Invite } from './entities/invite.entity';
import { LinkRequest } from './entities/link-request.entity';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { LinkRequestsController } from './link-requests.controller';
import { AdminInvitesController } from './admin-invites.controller';
import { AdminLinkRequestsController } from './admin-link-requests.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * TZ 9.2 onboarding: public invite lookup/claim and linkage requests plus the
 * FR-STF-04 staff management surface.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Invite, LinkRequest]), AuthModule, NotificationsModule],
  controllers: [
    InvitesController,
    LinkRequestsController,
    AdminInvitesController,
    AdminLinkRequestsController,
  ],
  providers: [InvitesService],
})
export class InvitesModule {}
