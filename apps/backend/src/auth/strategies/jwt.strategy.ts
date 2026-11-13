import { Injectable, Optional, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

import { UsersService } from "../../users/users.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { AppConfig } from "../../config/configuration";
import { isUserRole, UserRole } from "../interfaces/user-role";
import { TenantContext } from '../../common/tenant/tenant-context';
import { TelemetryService } from '../../telemetry/telemetry.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService<
      AppConfig & Record<string, unknown>
    >,
    private readonly usersService: UsersService,
    @Optional() private readonly telemetry?: TelemetryService,
    private readonly tenant: TenantContext = new TenantContext(),
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("auth.jwt.secret"),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.tenant.runWithDatabaseAccess(
      { authentication: { id: payload.sub } },
      () => this.usersService.findById(payload.sub),
    );

    if (
      !user ||
      !user.isActive ||
      !isUserRole(payload.role) ||
      user.role !== payload.role ||
      user.sessionVersion !== payload.sessionVersion
    ) {
      throw new UnauthorizedException();
    }

    if (payload.sid && this.telemetry && !await this.telemetry.isSessionActive(payload.sid, user.id)) {
      throw new UnauthorizedException();
    }

    // ADR-0009 dual-read: effective roles of the active organization. The
    // membership read needs both the authentication capability (row lookup)
    // and an explicit user_role grant scoped to the active organization; with
    // no membership rows the legacy users.role keeps serving as before.
    let roles: UserRole[] = [user.role];
    const activeOrganizationId = user.organizationId;
    if (activeOrganizationId) {
      const memberships = await this.tenant.runWithDatabaseAccess({ authentication: { id: payload.sub } }, () =>
        this.tenant.runWithDatabaseAccess(
          { tables: ['user_role'], organizationIds: [activeOrganizationId] },
          () => this.usersService.findMembershipRoles(user.id, activeOrganizationId),
        ),
      );
      const effective = memberships.filter(isUserRole);
      if (effective.length) roles = effective;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      roles,
      organizationId: user.organizationId,
      groupId: user.groupId,
      sessionVersion: user.sessionVersion,
      ...(payload.sid ? { sessionId: payload.sid } : {}),
    };
  }
}
