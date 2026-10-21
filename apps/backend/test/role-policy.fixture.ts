import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CanActivate, RequestMethod, Type } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { USER_ROLES, UserRole } from '../src/auth/interfaces/user-role';
import { Permission, ROLE_PERMISSIONS } from '../src/common/authorization/permissions';
import { PERMISSIONS_KEY } from '../src/common/authorization/permissions.decorator';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator';

export interface RoleRoute {
  source: string;
  controller: Type;
  handler: (...args: unknown[]) => unknown;
  id: string;
  method: string;
  path: string;
  guards: Type<CanActivate>[];
  roles: UserRole[] | null;
  permissions: Permission[] | null;
}

function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? controllerFiles(path) : entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

/** Source declarations, including method overrides and class-level guards; no database or AppModule boot. */
export function discoverRoleRoutes(): RoleRoute[] {
  const root = join(__dirname, '../src');
  const reflector = new Reflector();
  return controllerFiles(root).flatMap(file => Object.values(require(file)).flatMap((controller: Type) => {
    if (typeof controller !== 'function' || !Reflect.hasMetadata(PATH_METADATA, controller)) return [];
    return Object.getOwnPropertyNames(controller.prototype).flatMap(name => {
      const handler = controller.prototype[name];
      if (typeof handler !== 'function' || !Reflect.hasMetadata(METHOD_METADATA, handler)) return [];
      const guards = [...(Reflect.getMetadata(GUARDS_METADATA, controller) || []), ...(Reflect.getMetadata(GUARDS_METADATA, handler) || [])];
      const paths = [Reflect.getMetadata(PATH_METADATA, controller)].flat();
      const methods = [Reflect.getMetadata(PATH_METADATA, handler)].flat();
      return paths.flatMap(prefix => methods.map(suffix => {
        const path = '/api/v1/' + [prefix, suffix].filter(Boolean).join('/').replace(/^\/+|\/+$/g, '');
        const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
        return {
          source: 'apps/backend/src/' + relative(root, file).replace(/\\/g, '/'),
          controller, handler, guards, method, path,
          id: `${controller.name}.${name} ${method} ${path}`,
          roles: reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [handler, controller]) ?? null,
          permissions: reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [handler, controller]) ?? null,
        };
      }));
    });
  })).sort((a, b) => a.id.localeCompare(b.id));
}

export function rolePolicySnapshot(routes = discoverRoleRoutes()) {
  return {
    roles: USER_ROLES,
    permissions: ROLE_PERMISSIONS,
    routes: routes.map(({ id, source, method, path, guards, roles, permissions }) => ({
      id, source, method, path, guards: guards.map(guard => guard.name), roles, permissions,
      // Reviewable baseline for guard admission. Services, grants and ownership may still deny access.
      statuses: Object.fromEntries(USER_ROLES.map(role => {
        const careerRole = [UserRole.EMPLOYER, UserRole.CAREER_STAFF, UserRole.CAREER_ADMIN].includes(role);
        const careerPath = /^\/api\/v1\/career(?:\/|$)/.test(path) || path === '/api/v1/users/me' || ['/api/v1/auth/logout', '/api/v1/auth/max/status', '/api/v1/auth/max/link'].includes(path);
        const denied = (guards.some(guard => guard.name === 'JwtAuthGuard') && careerRole && !careerPath) ||
          (guards.some(guard => guard.name === 'RolesGuard') && roles !== null && !roles.includes(role)) ||
          (guards.some(guard => guard.name === 'PermissionsGuard') && permissions?.some(permission => !ROLE_PERMISSIONS[role].includes(permission)));
        return [role, denied ? 403 : 200];
      })),
    })),
  };
}

export function renderRoleMatrix(snapshot: ReturnType<typeof rolePolicySnapshot>): string {
  const lines = [
    '# Матрица ролей и входного контроля API', '',
    'Справочник текущей реализации на 22 октября 2026 года. В `UserRole` **11 ролей**. Матрица фиксирует входной контроль guards, а не полный доступ к данным.', '',
    'Источники: [роли](../../apps/backend/src/auth/interfaces/user-role.ts), [ROLE_PERMISSIONS](../../apps/backend/src/common/authorization/permissions.ts), [маршрутные decorators и guards](../../apps/backend/src/common/guards/roles.guard.ts).', '',
    '## Как читать и проверять', '',
    '- `200` — реальные guards допустили запрос к синтетическому HTTP probe. Контроллеры, DTO, сервисы, БД, resource ownership, tenant isolation, platform grants, maintenance и rate limits в этом probe не исполняются. Реальный endpoint может вернуть 201/204/400/403/404 и другие ответы.',
    '- `403` — реальная входная проверка отклонила эту роль. `401` — каждый защищённый маршрут проверяется без JWT и с неверной подписью JWT.',
    '- JWT подписан локальным тестовым ключом; реальный JwtStrategy проверяет claims по in-memory UsersService. Это HTTP/JWT/guard proof, а не PostgreSQL или production proof.',
    '- В матрице обычные роли привязаны к одному тестовому вузу; employer/career_staff/career_admin не имеют вуза. Отдельные тесты проверяют developer/superadmin без вуза. Кураторские назначения, гранты платформы и сервисные ограничения не выводятся из основной роли.',
    '- Автоматическое перечисление читает все `*.controller.ts`, class/method guards и override metadata. Незащищённые исходные объявления приведены отдельно. Snapshot блокирует незаметное изменение маршрутов, guards, enum и разрешений.', '',
    '```powershell',
    'pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand role-policy.e2e-spec',
    '# После осознанного review изменения ACL обновить snapshot и этот справочник:',
    'pnpm --filter @napare/backend exec ts-node --transpile-only test/update-role-policy.ts',
    '```', '',
    'Файлы: [HTTP tests](../../apps/backend/test/role-policy.e2e-spec.ts), [зафиксированный baseline](../../apps/backend/test/fixtures/role-policy.json). Тесты сравнивают актуальную metadata с baseline до проверки HTTP; generator никогда не запускается автоматически в CI.', '',
    '## Разрешения ROLE_PERMISSIONS', '',
    '| Роль | Разрешения |', '| --- | --- |',
    ...snapshot.roles.map(role => `| \`${role}\` | ${snapshot.permissions[role].map(permission => `\`${permission}\``).join(', ') || 'Нет разрешений из этого набора'} |`), '',
    'Этот набор применяется PermissionsGuard к academic API. Большинство остальных API используют @Roles либо сервисные проверки. Отсутствие разрешений из этого набора не означает запрет всех API.', '',
    '## Защищённые маршруты', '',
    '| Маршрут | Guards | ' + snapshot.roles.join(' | ') + ' |',
    '| --- | --- | ' + snapshot.roles.map(() => '---').join(' | ') + ' |',
    ...snapshot.routes.filter(route => route.guards.includes('JwtAuthGuard')).map(route => `| \`${route.method} ${route.path}\` | ${route.guards.join(', ')} | ${snapshot.roles.map(role => route.statuses[role]).join(' | ')} |`), '',
    '## Объявления без JwtAuthGuard', '',
    'Это inventory, а не автоматическое подтверждение безопасности публичного API: webhook secrets и бизнес-проверки находятся в контроллерах/сервисах.', '',
    '| Маршрут | Источник |', '| --- | --- |',
    ...snapshot.routes.filter(route => !route.guards.includes('JwtAuthGuard')).map(route => `| \`${route.method} ${route.path}\` | [${route.source}](../../${route.source}) |`), '',
    '## CI и границы проверки', '',
    'Job Backend E2E создаёт отдельные disposable базы curation/platform/tenant и runtime-роль NOSUPERUSER NOBYPASSRLS. CURATION_TEST_DATABASE_URL, PLATFORM_TEST_DATABASE_URL и TENANT_TEST_DATABASE_URL включают реальные HTTP/БД suites; TENANT_RLS_TEST_ADMIN_URL используется только для создания и удаления изолированных RLS fixtures. Тест транспорта host agent требует PLATFORM_AGENT_SOCKET. Проверка guards не заменяет эти проверки ресурсов и RLS.', '',
    'Старые датированные UX-отчёты с восемью ролями описывают историческую проверку; они не являются актуальной матрицей ACL. [Обзор ролей](../architecture/roles-and-permissions.md).', '',
  ];
  return lines.join('\n');
}
