import { Injectable, Optional, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

import { UsersService } from "../../users/users.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { AppConfig } from "../../config/configuration";
import { isUserRole } from "../interfaces/user-role";
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

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      universityId: user.universityId,
      groupId: user.groupId,
      sessionVersion: user.sessionVersion,
      ...(payload.sid ? { sessionId: payload.sid } : {}),
    };
  }
}
