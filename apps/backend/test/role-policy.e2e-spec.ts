import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CanActivate, Controller, ExecutionContext, Get, INestApplication, Injectable, Type, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { isObservable, lastValueFrom } from 'rxjs';
import * as request from 'supertest';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { USER_ROLES, UserRole } from '../src/auth/interfaces/user-role';
import { UsersService } from '../src/users/users.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PermissionsGuard } from '../src/common/authorization/permissions.guard';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { discoverRoleRoutes, renderRoleMatrix, rolePolicySnapshot } from './role-policy.fixture';

const routes = discoverRoleRoutes();
const baseline: ReturnType<typeof rolePolicySnapshot> = JSON.parse(readFileSync(join(__dirname, 'fixtures/role-policy.json'), 'utf8'));
const protectedRoutes = routes.filter(route => route.guards.includes(JwtAuthGuard));
const secret = randomUUID();
const tenant = randomUUID();
const users = new Map(USER_ROLES.map(role => [role, {
  id: role, email: `${role}@roles.example.test`, role, isActive: true, sessionVersion: 1,
  universityId: [UserRole.EMPLOYER, UserRole.CAREER_STAFF, UserRole.CAREER_ADMIN].includes(role) ? null : tenant,
  groupId: null,
}]));

/** Only the HTTP probe is synthetic. Guards inspect the original controller/handler metadata. */
@Injectable()
class RoleProbeGuard implements CanActivate {
  constructor(private jwt: JwtAuthGuard, private roles: RolesGuard, private permissions: PermissionsGuard) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const route = protectedRoutes[Number(req.params.index)];
    req.originalUrl = route.path;
    const original = new ExecutionContextHost(context.getArgs(), route.controller, route.handler);
    original.setType('http');
    const instances = new Map<Type<CanActivate>, CanActivate>([[JwtAuthGuard, this.jwt], [RolesGuard, this.roles], [PermissionsGuard, this.permissions]]);
    for (const guard of route.guards) {
      const instance = instances.get(guard);
      if (!instance) throw new Error(`Uncovered guard ${guard.name} on ${route.id}`);
      const result = instance.canActivate(original);
      const allowed = isObservable(result) ? await lastValueFrom(result) : await result;
      if (!allowed) return false;
    }
    return true;
  }
}

@Controller('role-policy-probe')
@UseGuards(RoleProbeGuard)
class ProbeController {
  @Get(':index')
  admitted() { return { guardAllowed: true }; }
}

describe('Every declared protected route × every role (real HTTP/JWT/guards, synthetic handler)', () => {
  let app: INestApplication;
  const tokens = new Map<UserRole, string>();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({ secret })],
      controllers: [ProbeController],
      providers: [RoleProbeGuard, JwtAuthGuard, RolesGuard, PermissionsGuard, TenantContext, JwtStrategy,
        { provide: ConfigService, useValue: new ConfigService({ auth: { jwt: { secret } } }) },
        { provide: UsersService, useValue: { findById: async (id: UserRole) => users.get(id) } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    for (const role of USER_ROLES) tokens.set(role, module.get(JwtService).sign({ sub: role, role, sessionVersion: 1 }));
  });
  afterAll(async () => { await app?.close(); });

  it('matches the reviewed enum, permission and complete route metadata baseline', () => {
    expect(rolePolicySnapshot(routes)).toEqual(baseline);
    expect(protectedRoutes.length).toBeGreaterThan(0);
  });
  it('keeps the human-readable matrix identical to the reviewed baseline', () => {
    expect(readFileSync(join(__dirname, '../../../docs/security/role-matrix.md'), 'utf8').replace(/\r\n/g, '\n')).toBe(renderRoleMatrix(baseline));
  });
  it('has no ignored guard or role/permission policy without its enforcing guard', () => {
    for (const route of routes) {
      if (route.roles) expect(route.guards).toContain(RolesGuard);
      if (route.permissions) expect(route.guards).toContain(PermissionsGuard);
      for (const guard of route.guards) expect([JwtAuthGuard, RolesGuard, PermissionsGuard]).toContain(guard);
    }
  });

  describe.each(protectedRoutes.map((route, index) => ({ route, index })))('$route.id', ({ route, index }) => {
    const expected = baseline.routes.find(item => item.id === route.id);
    it.each(['missing', 'invalid signature'])('returns HTTP 401 for %s JWT', async kind => {
      const call = request(app.getHttpServer()).get(`/role-policy-probe/${index}`);
      if (kind === 'invalid signature') call.auth(new JwtService({ secret: 'different-test-signing-key' }).sign({ sub: UserRole.STUDENT, role: UserRole.STUDENT, sessionVersion: 1 }), { type: 'bearer' });
      await call.expect(401);
    });
    it.each(USER_ROLES)('checks %s with signed JWT against reviewed guard admission', async role => {
      expect(expected).toBeDefined();
      const response = await request(app.getHttpServer()).get(`/role-policy-probe/${index}`).auth(tokens.get(role)!, { type: 'bearer' });
      expect(response.status).toBe(expected!.statuses[role]);
      if (response.status === 200) expect(response.body).toEqual({ guardAllowed: true });
    });
  });

  it.each([UserRole.DEVELOPER, UserRole.SUPERADMIN])('checks %s without university across all protected routes', async role => {
    const user = users.get(role)!;
    user.universityId = null;
    try {
      for (const [index, route] of protectedRoutes.entries()) {
        const platform = /^\/api\/v1\/platform(?:\/|$)/.test(route.path);
        const account = /^\/api\/v1\/career(?:\/|$)/.test(route.path) || route.path === '/api/v1/users/me' || ['/api/v1/auth/logout', '/api/v1/auth/max/status', '/api/v1/auth/max/link'].includes(route.path);
        const baselineStatus = baseline.routes.find(item => item.id === route.id)!.statuses[role];
        await request(app.getHttpServer()).get(`/role-policy-probe/${index}`).auth(tokens.get(role)!, { type: 'bearer' }).expect(platform || account ? baselineStatus : 403);
      }
    } finally { user.universityId = tenant; }
  }, 30000);
});
