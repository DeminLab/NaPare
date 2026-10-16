# Архитектура Backend (NestJS)

Дополнение от 2026-10-16: `AppModule` регистрирует `CurationModule` и `PlatformModule`. Назначения по группам и совместимость прежнего куратора описаны в [кураторстве](../product/account-curatorship.md); владелец, делегирование и host-агент — в [управлении платформой](../product/platform-control.md). Дерево ниже — обзор прежней структуры, а не полный автоматически обновляемый инвентарь; новые пути сверяйте с `apps/backend/src` и source cards.

## Общая структура

Дерево сгенерировано по `apps/backend/src` (файлы `*.spec.ts` опущены — см. раздел «Тестирование»).

```
apps/backend/src/
├── main.ts                               # Bootstrap: prefix, Swagger, ValidationPipe, фильтры, CORS, Sentry
├── app.module.ts                         # Корневой модуль: Config, TypeORM, EventEmitter, Throttler
├── app.controller.ts                     # GET /api/v1/app
├── health.controller.ts                  # GET /api/v1/health
│
├── common/                               # Общие компоненты
│   ├── authorization/
│   │   ├── permissions.ts                # PERMISSIONS / ROLE_PERMISSIONS / hasPermission()
│   │   ├── permissions.decorator.ts      # @RequiresPermission(...)
│   │   └── permissions.guard.ts          # Проверка прав по роли user.role
│   ├── decorators/
│   │   └── roles.decorator.ts            # @Roles(...)
│   ├── guards/
│   │   ├── jwt-auth.guard.ts             # Passport 'jwt' + TenantContext.setUser()
│   │   ├── roles.guard.ts                # Доступ по единственной роли user.role
│   │   └── university.guard.ts           # Доступ к данным своего вуза
│   ├── interceptors/
│   │   └── transform.interceptor.ts      # Лог длительности HTTP-запроса
│   ├── filters/
│   │   └── http-exception.filter.ts      # Единый формат ошибок
│   ├── dto/
│   │   ├── pagination-query.dto.ts       # PaginationQueryDto + toPaginatedResponse()
│   │   ├── date-range-query.dto.ts
│   │   └── api-error-response.dto.ts     # Модель ошибки для Swagger
│   ├── tenant/
│   │   ├── tenant-context.ts             # AsyncLocalStorage + assertAccess()
│   │   └── tenant-context.module.ts
│   ├── entities/
│   │   └── audit-log.entity.ts
│   └── types/
│       └── json-value.type.ts
│
├── config/                               # Конфигурация
│   ├── configuration.ts                  # nodeEnv, auth.jwt.*, max.*
│   ├── database.config.ts                # DataSource для CLI TypeORM (миграции)
│   └── validate-environment.ts           # Проверка обязательных ENV-переменных
│
├── auth/                                 # Модуль авторизации
│   ├── auth.module.ts
│   ├── auth.controller.ts                # /api/v1/auth/*
│   ├── auth.service.ts
│   ├── max-init-data.ts                  # Проверка initData MAX (HMAC)
│   ├── rasp-scraper.service.ts           # Живой источник rasp.sano.ru
│   ├── sibit-university-bootstrap.service.ts # Пилотный вуз при старте
│   ├── strategies/
│   │   └── jwt.strategy.ts               # Passport JWT
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── register.dto.ts
│   │   ├── refresh-token.dto.ts
│   │   └── max-auth.dto.ts
│   └── interfaces/
│       ├── authenticated-user.interface.ts
│       ├── auth-response.interface.ts
│       ├── jwt-payload.interface.ts
│       └── user-role.ts                  # enum UserRole (8 значений)
│
├── users/                                # Модуль пользователей
│   ├── users.module.ts
│   ├── users.controller.ts               # /api/v1/users/*
│   ├── users.service.ts
│   ├── entities/
│   │   ├── user.entity.ts                # users: role (enum), university_id, group_id
│   │   ├── university.entity.ts
│   │   ├── faculty.entity.ts
│   │   ├── group.entity.ts
│   │   └── teacher.entity.ts
│   └── dto/
│       ├── create-user.dto.ts
│       ├── update-user.dto.ts
│       └── bind-group.dto.ts
│
├── universities/
│   └── entities/
│       └── university.entity.ts          # re-export users/entities/university.entity
│
├── schedule/                             # Модуль расписания
│   ├── schedule.module.ts
│   ├── schedule.controller.ts            # /api/v1/schedule/*
│   ├── schedule.service.ts
│   ├── change-detector.service.ts        # Детект изменений пар
│   ├── connectors/
│   │   ├── excel-connector.service.ts    # Excel-импорт (xlsx)
│   │   └── sibit-connector.service.ts    # Расписание СИБИТ через rasp-scraper
│   ├── entities/
│   │   ├── lesson.entity.ts
│   │   └── lesson-change.entity.ts
│   ├── dto/
│   │   ├── create-lesson.dto.ts
│   │   ├── update-lesson.dto.ts
│   │   └── schedule-query.dto.ts
│   └── utils/
│       └── date-range.ts
│
├── pair-space/                           # Модуль пространства пары
│   ├── pair-space.module.ts
│   ├── pair-space.controller.ts          # /api/v1/pair-spaces/*
│   ├── pair-space.service.ts
│   ├── entities/
│   │   ├── pair-space.entity.ts
│   │   ├── announcement.entity.ts
│   │   ├── homework.entity.ts
│   │   ├── homework-submission.entity.ts
│   │   ├── file-attachment.entity.ts
│   │   └── discussion-message.entity.ts
│   └── dto/
│       ├── create-announcement.dto.ts
│       ├── create-homework.dto.ts
│       ├── submit-homework.dto.ts
│       ├── create-message.dto.ts
│       └── create-file.dto.ts
│
├── absences/                             # Модуль отсутствий и посещаемости
│   ├── absences.module.ts
│   ├── absences.controller.ts            # /api/v1/absences/*
│   ├── curator.controller.ts             # /api/v1/curator/*
│   ├── absences.service.ts
│   ├── entities/
│   │   ├── absence.entity.ts
│   │   ├── absence-confirmation.entity.ts
│   │   └── attendance-record.entity.ts
│   └── dto/
│       ├── create-absence.dto.ts
│       ├── confirm-absence.dto.ts
│       ├── reject-absence.dto.ts
│       ├── mark-attendance.dto.ts
│       ├── update-absence.dto.ts
│       └── absence-list-query.dto.ts
│
├── academic/                             # Учебный контекст (курсы, серии, занятия)
│   ├── academic.module.ts
│   ├── academic.controller.ts            # Права через @RequiresPermission
│   ├── academic.service.ts
│   ├── academic.types.ts
│   ├── entities/                         # 7 entity (course, lesson-series, lesson-occurrence, ...)
│   └── dto/                              # 7 DTO
│
├── notifications/                        # Модуль уведомлений
│   ├── notifications.module.ts
│   ├── notifications.controller.ts       # /api/v1/notifications/*
│   ├── devices.controller.ts             # /api/v1/devices/*
│   ├── notifications.service.ts
│   ├── events/
│   │   └── notification-event.handler.ts # @OnEvent('napare.event')
│   ├── entities/
│   │   ├── notification.entity.ts
│   │   ├── inbox-item.entity.ts
│   │   ├── device-token.entity.ts
│   │   └── notification-preference.entity.ts
│   └── dto/                              # 5 DTO
│
├── events/                               # Шина событий (EventBusService + SSE)
│   ├── events.module.ts
│   ├── events.controller.ts
│   ├── event-bus.service.ts              # Публикация/реплей, идемпотентность
│   ├── event.types.ts                    # EventEnvelope, NAPARE_EVENT_TYPES
│   └── entities/
│       └── event-record.entity.ts
│
├── my-day/                               # «Мой день»
│   ├── my-day.module.ts
│   ├── my-day.controller.ts
│   └── my-day.service.ts
│
├── admin/                                # Администрирование
│   ├── admin.module.ts
│   ├── admin.controller.ts               # /api/v1/admin/*
│   ├── superadmin.controller.ts          # /api/v1/superadmin/*
│   ├── admin.service.ts
│   ├── superadmin.service.ts
│   └── dto/                              # 12 DTO
│
├── rasp/
│   └── rasp.module.ts
│
├── database/
│   ├── database.module.ts                # forFeature по всем entity, экспорт репозиториев
│   └── init.sql                          # SQL-инициализация (не выполняется модулем)
│
└── migrations/                           # TypeORM-миграции (17 файлов)
    ├── 1700000000000-InitialSchema.ts
    ├── 1700000000001-NormalizeUserRole.ts
    ├── 1700000000002-OptimizeTenantQueriesAndIntegrity.ts
    ├── 1700000000003-EventDrivenNotifications.ts
    ├── 1700000000004-AcademicContext.ts
    ├── 1700000000005-EventIdempotency.ts
    ├── 1700000000006-MaxUserLink.ts
    └── 1700000000007-AttendanceRecords.ts
```

В production NestJS автоматически выполняет ожидающие TypeORM-миграции при старте backend (`migrationsRun: true`). Отдельный запуск migration CLI для production Compose не требуется; после выпуска проверьте логи backend и состояние таблицы миграций. Перед изменением схемы сделайте резервную копию PostgreSQL.

## Ключевые настройки bootstrap

| Что | Где | Значение |
|-----|-----|----------|
| Глобальный префикс | `main.ts:66` | `app.setGlobalPrefix('api/v1')` |
| Swagger | `main.ts:79` | `http://localhost:3000/api/v1/docs` |
| ValidationPipe | `main.ts:30-36` | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| Глобальный фильтр | `main.ts:39` | `AllExceptionsFilter` |
| Глобальный интерцептор | `main.ts:42` | `TransformInterceptor` (лог длительности) |
| Sentry | `main.ts:20-27` | инициализируется только если задан `SENTRY_DSN` |
| TypeORM | `app.module.ts:35-63` | `synchronize: true` вне production, `migrationsRun: true` в production |
| Обязательные ENV | `config/validate-environment.ts` | `NODE_ENV`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` |

## Паттерны

### 1. Repository Pattern

```typescript
// users/entities/user.entity.ts
@Entity('users')
@Index('IDX_users_university_id', ['universityId'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  // Единственная роль пользователя (enum), не массив
  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Column({ type: 'uuid' })
  universityId: string;

  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 2. Service Pattern

```typescript
// users/users.service.ts
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly tenantContext: TenantContext,
  ) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (user) this.tenantContext.assertAccess(user.universityId);
    return user;
  }

  async findByUniversityId(
    universityId: string,
    pagination: PaginationQueryDto = new PaginationQueryDto(),
    roles?: UserRole[],
  ): Promise<PaginatedResponse<User>> {
    this.tenantContext.assertAccess(universityId);
    const [data, total] = await this.usersRepository.findAndCount({
      where: { universityId, ...(roles?.length ? { role: In(roles) } : {}) },
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    return toPaginatedResponse(data, total, pagination);
  }
}
```

Бизнесные ошибки бросаются стандартными исключениями NestJS
(`NotFoundException`, `ConflictException`, `ForbiddenException`) —
`AllExceptionsFilter` приводит их к единому формату ответа.

### 3. Controller Pattern

```typescript
// users/users.controller.ts
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me')
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.id, updateUserDto);
  }
}
```

Пользователь в запросе появляется через `JwtAuthGuard`
(`common/guards/jwt-auth.guard.ts`) — декоратора `@CurrentUser()` в кодовой базе нет.

### 4. DTO Pattern

```typescript
// users/dto/update-user.dto.ts
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Иван' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Иванов' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+7 999 123 4567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
```

Незнакомые поля DTO отклоняются: глобальный `ValidationPipe` включает
`whitelist` + `forbidNonWhitelisted` (`main.ts:30-36`).

### 5. Guard Pattern

```typescript
// common/guards/roles.guard.ts
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

У пользователя **одна** роль (`user.role`), поэтому guard сравнивает её с
списком допустимых ролей напрямую — иерархии ролей в коде нет.

### 6. Interceptor Pattern

```typescript
// common/interceptors/transform.interceptor.ts
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

Интерцептор **не оборачивает ответ** — он только пишет лог длительности.
Конверт `{ data, meta }` формируют хелперы пагинации
(`toPaginatedResponse()` в `common/dto/pagination-query.dto.ts`), а единый формат
ошибок — `AllExceptionsFilter` (см. [error-handling.md](error-handling.md)).

## Межмодульное взаимодействие

### 1. Прямые вызовы (предпочтительно)

Модули импортируют друг друга напрямую, `forwardRef` в кодовой базе не используется:

```typescript
// schedule/schedule.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson, LessonChange, LessonOccurrence, ScheduleChange]),
    HttpModule,
    RaspModule,
    EventsModule,
  ],
  controllers: [ScheduleController],
  providers: [
    ScheduleService,
    ChangeDetectorService,
    ExcelConnectorService,
    SibitConnectorService,
  ],
  exports: [ScheduleService, SibitConnectorService],
})
export class ScheduleModule {}
```

### 2. Event Bus (для уведомлений)

Публикация события из сервиса:

```typescript
// schedule/schedule.service.ts
await this.eventBus?.publish({
  type: eventType, // 'lesson.changed' | 'room.changed' | 'lesson.rescheduled' | ...
  universityId: lesson.universityId,
  actor: this.eventActor(),
  target: { type: 'lesson', id: lesson.id },
  payload: {
    oldValue,
    newValue: updatedValues,
    groupId: lesson.groupId,
    teacherId: lesson.teacherId,
    deepLink: `/week?date=${lesson.startDate.toISOString().slice(0, 10)}`,
  },
  priority: eventType === 'lesson.changed' ? 'normal' : 'high',
});
```

`EventBusService.publish()` (`events/event-bus.service.ts`) сохраняет `EventRecord`
(поле `idempotencyKey` делает повторные публикации идемпотентными), рассылает
сообщение в открытые SSE-потоки и эмитит `napare.event` через `EventEmitter2`.
Дополнительно часть сервисов напрямую вызывает `eventEmitter.emit('lesson.changed', …)`.

Потребитель:

```typescript
// notifications/events/notification-event.handler.ts
@Injectable()
export class NotificationEventHandler {
  @OnEvent('napare.event', { async: true })
  async handle(event: EventEnvelope): Promise<void> {
    const recipientIds = await this.resolveRecipients(event);
    if (recipientIds.length === 0) return;
    await this.notificationsService.processEvent(event, recipientIds);
  }
}
```

Список типов событий — `NAPARE_EVENT_TYPES` в `events/event.types.ts`.

## Middleware

`AppModule.configure()` пуст — middleware не регистрируется:

```typescript
// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Middleware can be added here
  }
}
```

Мультитенантность и правила доступа реализованы на уровне guard'ов и сервисов:

- `JwtAuthGuard` сохраняет пользователя в `TenantContext` (`AsyncLocalStorage`);
- `TenantContext.assertAccess(universityId)` (`common/tenant/tenant-context.ts`) кидает
  `ForbiddenException`, если пользователь не из этого вуза (кроме `superadmin`);
- `UniversityGuard` сверяет `params.universityId || params.id` с `user.universityId`.

## Конфигурация

Runtime-подключение задаётся в `app.module.ts` (поддерживаются и `DATABASE_URL`, и `DB_*`):

```typescript
// app.module.ts (фрагмент)
const databaseUrl = configService.get<string>('DATABASE_URL');
if (databaseUrl) {
  return {
    type: 'postgres' as const,
    url: databaseUrl,
    autoLoadEntities: true,
    migrations: [join(__dirname, 'migrations/*.{js,ts}')],
    migrationsRun: configService.getOrThrow('nodeEnv') === 'production',
    synchronize: configService.getOrThrow('nodeEnv') !== 'production',
  };
}
// иначе — host/port/username/password/database из DB_* с теми же
// migrations / migrationsRun / synchronize
```

Отдельный `DataSource` для CLI миграций — `config/database.config.ts`:

```typescript
// config/database.config.ts
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'napare',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
```

Команды (корень `apps/backend/package.json`):

```bash
pnpm --filter @napare/backend typeorm:migration:generate
pnpm --filter @napare/backend typeorm:migration:run
pnpm --filter @napare/backend typeorm:migration:revert
```

## Тестирование

Юнит-тесты лежат рядом с кодом — `src/**/*.spec.ts` (26 файлов), в `test/` только один
e2e-тест и его конфигурация:

```
apps/backend/
├── src/
│   ├── api-contract.spec.ts
│   ├── absences/absences.controller.spec.ts
│   ├── absences/absences.service.spec.ts
│   ├── auth/auth.controller.spec.ts
│   ├── auth/auth.service.spec.ts
│   ├── common/**/**.spec.ts            # permissions, guards, filter, tenant, dto
│   └── ... (всего 26 файлов *.spec.ts)
└── test/
    ├── app.e2e-spec.ts                 # GET /api/v1/health, GET /api/v1/app
    └── jest-e2e.json                   # конфигурация e2e-запуска
```

```bash
pnpm test:unit                # jest --ci --runInBand (только backend)
pnpm test:e2e                 # jest --config ./test/jest-e2e.json
pnpm --filter @napare/backend test:cov
```

## ENV переменные

Обязательные — их отсутствие валит приложение при старте
(`config/validate-environment.ts` + `config/configuration.ts`):

```env
NODE_ENV=development            # development | test | production
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=30d
```

Остальные переменные, которые читает код backend:

```env
# Сервер и CORS
PORT=3000
CORS_ORIGIN=http://localhost:3001

# Database (достаточно DATABASE_URL либо группы DB_*)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/napare
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=napare

# Sentry (инициализируется только при заданном SENTRY_DSN, main.ts:20-27)
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1

# MAX Mini App
MAX_BOT_TOKEN=
MAX_INIT_DATA_TTL_SECONDS=900
```

`REDIS_*`, `FCM_*`, `STORAGE_*`, `RATE_LIMIT_*` объявлены в `.env.example` и
`docker-compose.prod.yml`, но код backend их не читает (лимитер — статический
`ThrottlerModule` в `app.module.ts`, push-сервиса нет). Полный состав переменных —
в разделе [config-files.md](config-files.md).
