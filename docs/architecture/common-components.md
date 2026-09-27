# Common Guards, Interceptors, Filters

## Структура

```
apps/backend/src/common/
├── authorization/
│   ├── permissions.ts                # PERMISSIONS, ROLE_PERMISSIONS, hasPermission()
│   ├── permissions.decorator.ts      # @RequiresPermission(...)
│   ├── permissions.guard.ts          # Проверка прав по user.role
│   └── permissions.spec.ts
├── decorators/
│   └── roles.decorator.ts            # @Roles(...), ROLES_KEY
├── guards/
│   ├── jwt-auth.guard.ts             # Passport 'jwt' + TenantContext.setUser()
│   ├── roles.guard.ts                # Доступ по единственной роли user.role
│   ├── roles.guard.spec.ts
│   ├── university.guard.ts           # Доступ к данным своего вуза
│   └── university.guard.spec.ts
├── interceptors/
│   └── transform.interceptor.ts      # Лог длительности HTTP-запроса
├── filters/
│   ├── http-exception.filter.ts      # Единый формат ошибок
│   └── http-exception.filter.spec.ts
├── dto/
│   ├── pagination-query.dto.ts       # PaginationQueryDto, toPaginatedResponse()
│   ├── pagination-query.dto.spec.ts
│   ├── date-range-query.dto.ts
│   └── api-error-response.dto.ts     # Модель ошибки для Swagger
├── tenant/
│   ├── tenant-context.ts             # AsyncLocalStorage + assertAccess()
│   ├── tenant-context.spec.ts
│   └── tenant-context.module.ts
├── entities/
│   └── audit-log.entity.ts
└── types/
    └── json-value.type.ts
```

Подпапок `pipes/`, `middleware/`, `utils/` и файлов `current-user.decorator.ts`,
`university.decorator.ts`, `jwt-refresh.guard.ts`, `logging.interceptor.ts`,
`cache.interceptor.ts` в кодовой базе нет. Backend не импортирует
`@napare/shared` — типы ролей и пользователя лежат в `auth/interfaces/`.

## Guards

```typescript
// guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly tenantContext: TenantContext) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    error: unknown,
    user: TUser | false | null,
    _info?: unknown,
    _context?: ExecutionContext,
    _status?: number,
  ): TUser {
    if (error instanceof Error) throw error;
    if (!isAuthenticatedUser(user)) {
      throw new UnauthorizedException();
    }
    this.tenantContext.setUser(user);
    return user;
  }
}
```

`isAuthenticatedUser()` проверяет наличие `id`, `role` и `universityId` —
невалидный payload JWT не проходит.

```typescript
// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user }: { user?: AuthenticatedUser } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
```

Иерархии ролей нет: у пользователя одна роль (`user.role`, `enum UserRole`),
guard просто проверяет её вхождение в список из `@Roles(...)`.

```typescript
// guards/university.guard.ts
@Injectable()
export class UniversityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params }: { user?: AuthenticatedUser; params: Record<string, string> } = request;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Superadmin can access any university
    if (user.role === UserRole.SUPERADMIN) {
      return true;
    }

    const universityId = params.universityId || params.id;

    if (universityId && user.universityId !== universityId) {
      throw new ForbiddenException('Access denied to this university');
    }

    return true;
  }
}
```

## Decorators

```typescript
// decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// authorization/permissions.decorator.ts
export const PERMISSIONS_KEY = 'permissions';
export const RequiresPermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

## Permission layer

```typescript
// authorization/permissions.ts
export const PERMISSIONS = {
  ACADEMIC_COURSE_READ: 'academic.course.read',
  ACADEMIC_COURSE_MANAGE: 'academic.course.manage',
  ACADEMIC_SERIES_READ: 'academic.series.read',
  ACADEMIC_SERIES_MANAGE: 'academic.series.manage',
  ACADEMIC_OCCURRENCE_READ: 'academic.occurrence.read',
  ACADEMIC_OCCURRENCE_MANAGE: 'academic.occurrence.manage',
  ACADEMIC_EVENT_READ: 'academic.event.read',
  ACADEMIC_EVENT_MANAGE: 'academic.event.manage',
  TECHNICAL_RESOURCE_READ: 'technical.resource.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const allAcademicRead: Permission[] = [
  PERMISSIONS.ACADEMIC_COURSE_READ,
  PERMISSIONS.ACADEMIC_SERIES_READ,
  PERMISSIONS.ACADEMIC_OCCURRENCE_READ,
  PERMISSIONS.ACADEMIC_EVENT_READ,
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.STUDENT]: allAcademicRead,
  [UserRole.TEACHER]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
  ],
  [UserRole.CURATOR]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
  ],
  [UserRole.DEPARTMENT_HEAD]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_COURSE_MANAGE,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
    PERMISSIONS.ACADEMIC_EVENT_MANAGE,
  ],
  [UserRole.FACULTY_DEAN]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_COURSE_MANAGE,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
    PERMISSIONS.ACADEMIC_EVENT_MANAGE,
  ],
  [UserRole.UNIVERSITY_ADMIN]: [
    ...allAcademicRead,
    PERMISSIONS.ACADEMIC_COURSE_MANAGE,
    PERMISSIONS.ACADEMIC_SERIES_MANAGE,
    PERMISSIONS.ACADEMIC_OCCURRENCE_MANAGE,
    PERMISSIONS.ACADEMIC_EVENT_MANAGE,
  ],
  [UserRole.SUPERADMIN]: Object.values(PERMISSIONS),
  [UserRole.DEVELOPER]: [PERMISSIONS.TECHNICAL_RESOURCE_READ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
```

```typescript
// authorization/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user || !required.every((permission) => hasPermission(user.role, permission))) {
      throw new ForbiddenException('Permission required');
    }
    return true;
  }
}
```

Используется в `academic.controller.ts`: `@UseGuards(JwtAuthGuard, PermissionsGuard)`
+ `@RequiresPermission(PERMISSIONS.ACADEMIC_COURSE_READ)` и т.д.

## TenantContext

```typescript
// tenant/tenant-context.ts
@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<AuthenticatedUser>();

  setUser(user: AuthenticatedUser): void {
    this.storage.enterWith(user);
  }

  getUser(): AuthenticatedUser | undefined {
    return this.storage.getStore();
  }

  assertAccess(universityId: string): void {
    const user = this.getUser();
    if (user && user.role !== UserRole.SUPERADMIN && user.universityId !== universityId) {
      throw new ForbiddenException('Access denied to this university');
    }
  }
}
```

Вызывается сервисами (`users.service.ts`, `admin.service.ts`, …) как вторая линия
защиты после guard'ов: `JwtAuthGuard` кладёт пользователя в контекст при аутентификации.

## Interceptors

```typescript
// interceptors/transform.interceptor.ts
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - now;
        this.logger.log(`${method} ${url} - ${elapsed}ms`);
      }),
    );
  }
}
```

Интерцептор не трансформирует тело ответа — он пишет лог длительности.
Формат `{ data, meta }` собирают хелперы пагинации
(`toPaginatedResponse()` в `common/dto/pagination-query.dto.ts`).

## Exception Filter

```typescript
// filters/http-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as ExceptionResponse;
        if (Array.isArray(body.message)) {
          details = body.message;
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
        } else if (body.message) {
          message = body.message;
        }
        code = body.code || code;
      }

      if (code === 'INTERNAL_SERVER_ERROR') {
        code = this.codeForStatus(status);
      }
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private codeForStatus(status: HttpStatus): string {
    const codes: Partial<Record<HttpStatus, string>> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
    };

    return codes[status] || 'HTTP_ERROR';
  }
}
```

Код `429` — `RATE_LIMITED` (не `RATE_LIMIT_EXCEEDED`). Sentry-интеграции в фильтре нет:
`Sentry.init` вызывается только в `main.ts` при заданном `SENTRY_DSN`.

## Validation Pipe

Отдельного `common/pipes/validation.pipe.ts` нет — pipe регистрируется глобально
в точке входа:

```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

## app.module.ts (реальное подключение глобальных прагм)

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
      validate: validateEnvironment,
      cache: true,
    }),
    TypeOrmModule.forRootAsync({ /* см. backend-architecture.md */ }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule,
    UsersModule,
    ScheduleModule,
    PairSpaceModule,
    AbsencesModule,
    NotificationsModule,
    AdminModule,
    MyDayModule,
    DatabaseModule,
    TenantContextModule,
    EventsModule,
    AcademicModule,
  ],
  controllers: [AppController, HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Middleware can be added here
  }
}
```

`ValidationPipe`, `AllExceptionsFilter` и `TransformInterceptor` подключаются в
`main.ts` через `useGlobalPipes` / `useGlobalFilters` / `useGlobalInterceptors`,
а не через провайдеры `APP_PIPE` / `APP_FILTER` / `APP_INTERCEPTOR`.
Middleware не регистрируется (`configure()` пуст), `UniversityMiddleware` отсутствует.

## См. также

- [backend-architecture.md](backend-architecture.md) — структура backend
- [roles-and-permissions.md](roles-and-permissions.md) — матрица прав
- [error-handling.md](error-handling.md) — формат ошибок
