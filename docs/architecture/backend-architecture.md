# Архитектура Backend (NestJS)

## Общая структура

```
apps/backend/src/
├── main.ts                          # Точка входа
├── app.module.ts                    # Корневой модуль
│
├── common/                          # Общие компоненты
│   ├── decorators/
│   │   ├── roles.decorator.ts       # @Roles('teacher')
│   │   ├── current-user.decorator.ts # @CurrentUser()
│   │   └── university.decorator.ts  # @UniversityId()
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        # JWT авторизация
│   │   ├── roles.guard.ts           # Проверка ролей
│   │   └── university.guard.ts      # Фильтрация по university_id
│   ├── interceptors/
│   │   ├── transform.interceptor.ts # Единый формат ответа
│   │   ├── logging.interceptor.ts   # Логирование запросов
│   │   └── cache.interceptor.ts     # Кэширование
│   ├── filters/
│   │   └── http-exception.filter.ts # Единый формат ошибок
│   ├── pipes/
│   │   ├── validation.pipe.ts       # Валидация DTO
│   │   └── parse-uuid.pipe.ts       # Парсинг UUID
│   ├── dto/
│   │   ├── pagination.dto.ts        # { page, limit, sort, order }
│   │   ├── id-param.dto.ts          # { id: UUID }
│   │   └── date-range.dto.ts        # { startDate, endDate }
│   ├── interfaces/
│   │   ├── jwt-payload.interface.ts # Payload JWT
│   │   └── request-with-user.ts     # Request с пользователем
│   ├── types/
│   │   └── express.d.ts             # Типы Express
│   └── utils/
│       ├── date.utils.ts            # Утилиты дат
│       └── crypto.utils.ts          # Шифрование
│
├── config/                          # Конфигурация
│   ├── app.config.ts                # Общие настройки
│   ├── database.config.ts           # PostgreSQL
│   ├── jwt.config.ts                # JWT секреты
│   ├── redis.config.ts              # Redis
│   ├── s3.config.ts                 # S3 хранилище
│   └── push.config.ts               # FCM/APNs
│
├── auth/                            # Модуль авторизации
│   ├── auth.module.ts
│   ├── auth.controller.ts           # /api/v1/auth/*
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts          # Passport JWT
│   │   └── jwt-refresh.strategy.ts  # Refresh token
│   ├── dto/
│   │   ├── request-code.dto.ts      # { phone } или { email }
│   │   ├── verify-code.dto.ts       # { code, phone/email }
│   │   ├── refresh.dto.ts           # { refreshToken }
│   │   └── max-auth.dto.ts          # { initData }
│   └── interfaces/
│       └── auth-result.interface.ts # { accessToken, refreshToken, user }
│
├── users/                           # Модуль пользователей
│   ├── users.module.ts
│   ├── users.controller.ts          # /api/v1/users/*
│   ├── users.service.ts
│   ├── entities/
│   │   ├── user.entity.ts           # Сущность пользователя
│   │   └── preference.entity.ts     # Настройки
│   ├── dto/
│   │   ├── update-profile.dto.ts    # { firstName, lastName, avatarUrl }
│   │   ├── bind-group.dto.ts        # { universityId, groupId }
│   │   └── user-response.dto.ts     # Ответ с пользователем
│   └── interfaces/
│       └── user-with-roles.ts       # Пользователь с ролями
│
├── schedule/                        # Модуль расписания
│   ├── schedule.module.ts
│   ├── schedule.controller.ts       # /api/v1/schedule/*
│   ├── schedule.service.ts
│   ├── change-detector.service.ts   # Детект изменений
│   ├── entities/
│   │   ├── lesson.entity.ts         # Пара
│   │   ├── lesson-change.entity.ts  # Изменение пары
│   │   └── university.entity.ts     # Вуз (с connector_config)
│   ├── connectors/
│   │   ├── schedule-connector.interface.ts # Интерфейс коннектора
│   │   ├── normalized-lesson.interface.ts  # Нормализованная пара
│   │   ├── excel.connector.ts       # Excel/CSV импорт
│   │   ├── sibit.connector.ts       # Парсер СИБИТ
│   │   └── connector.factory.ts     # Фабрика коннекторов
│   └── dto/
│       ├── schedule-query.dto.ts    # { startDate, endDate, groupId }
│       ├── upload-schedule.dto.ts   # Загрузка файла
│       └── schedule-response.dto.ts # Ответ с расписанием
│
├── pair-space/                      # Модуль пространства пары
│   ├── pair-space.module.ts
│   ├── pair-space.controller.ts     # /api/v1/pair-spaces/*
│   ├── pair-space.service.ts
│   ├── entities/
│   │   ├── pair-space.entity.ts     # Пространство пары
│   │   ├── announcement.entity.ts   # Объявление
│   │   ├── homework.entity.ts       # Домашнее задание
│   │   ├── homework-submission.entity.ts # Статус сдачи
│   │   ├── file-attachment.entity.ts # Файл
│   │   └── discussion-message.entity.ts # Сообщение обсуждения
│   └── dto/
│       ├── create-announcement.dto.ts
│       ├── create-homework.dto.ts
│       ├── submit-homework.dto.ts
│       ├── create-message.dto.ts
│       └── file-upload.dto.ts
│
├── absences/                        # Модуль отсутствий
│   ├── absences.module.ts
│   ├── absences.controller.ts       # /api/v1/absences/*, /api/v1/curator/*
│   ├── absences.service.ts
│   ├── entities/
│   │   ├── absence-status.entity.ts # Статус отсутствия
│   │   └── absence-confirmation.entity.ts # Подтверждение куратора
│   └── dto/
│       ├── create-absence.dto.ts
│       ├── confirm-absence.dto.ts
│       └── absence-query.dto.ts
│
├── notifications/                   # Модуль уведомлений
│   ├── notifications.module.ts
│   ├── notifications.controller.ts  # /api/v1/notifications/*
│   ├── notifications.service.ts
│   ├── push.service.ts              # Отправка push
│   ├── entities/
│   │   ├── notification.entity.ts   # Уведомление
│   │   └── device-token.entity.ts   # Токен устройства
│   └── dto/
│       ├── notification-query.dto.ts
│       ├── register-token.dto.ts
│       └── notification-settings.dto.ts
│
├── admin/                           # Модуль администрирования
│   ├── admin.module.ts
│   ├── admin.controller.ts          # /api/v1/admin/*
│   ├── admin.service.ts
│   ├── superadmin.controller.ts     # /api/v1/superadmin/*
│   ├── superadmin.service.ts
│   └── dto/
│       ├── university.dto.ts
│       ├── faculty.dto.ts
│       ├── group.dto.ts
│       ├── assign-roles.dto.ts
│       └── stats-query.dto.ts
│
└── database/                        # Модуль БД
    ├── database.module.ts
    └── seed.service.ts              # Seed data
```

## Паттерны

### 1. Repository Pattern

```typescript
// entities/user.entity.ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, unique: true })
  phone: string;

  @Column({ nullable: true, unique: true })
  email: string;

  @Column('text', { array: true, default: ['student'] })
  roles: Role[];

  @Column({ nullable: true })
  universityId: string;

  @Column({ nullable: true })
  groupId: string;

  @ManyToOne(() => University)
  @JoinColumn({ name: 'university_id' })
  university: University;

  @ManyToOne(() => Group)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 2. Service Pattern

```typescript
// users.service.ts
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BusinessError('USER_NOT_FOUND', 'Пользователь не найден');
    }
    return user;
  }

  async findByUniversity(universityId: string): Promise<User[]> {
    return this.userRepository.find({ where: { universityId } });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }
}
```

### 3. Controller Pattern

```typescript
// users.controller.ts
@ApiTags('Users')
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, UniversityGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Получить профиль текущего пользователя' })
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.usersService.findById(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Обновить профиль' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user.userId, dto);
  }
}
```

### 4. DTO Pattern

```typescript
// dto/update-profile.dto.ts
export class UpdateProfileDto {
  @ApiProperty({ example: 'Иван' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Иванов' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'https://...' })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}
```

### 5. Guard Pattern

```typescript
// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

### 6. Interceptor Pattern

```typescript
// interceptors/transform.interceptor.ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
```

## Межмодульное взаимодействие

### 1. Прямые вызовы (предпочтительно)

```typescript
// schedule.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson, LessonChange]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService, ChangeDetectorService],
  exports: [ScheduleService],
})
export class ScheduleModule {}

// pair-space.service.ts
@Injectable()
export class PairSpaceService {
  constructor(
    @InjectRepository(PairSpace)
    private readonly pairSpaceRepository: Repository<PairSpace>,
    @Inject(forwardRef(() => ScheduleService))
    private readonly scheduleService: ScheduleService,
  ) {}

  async createForLesson(lessonId: string): Promise<PairSpace> {
    const lesson = await this.scheduleService.findLessonById(lessonId);
    const pairSpace = this.pairSpaceRepository.create({
      lessonId,
      activeUntil: new Date(lesson.endDate.getTime() + 45 * 24 * 60 * 60 * 1000),
    });
    return this.pairSpaceRepository.save(pairSpace);
  }
}
```

### 2. Event Bus (для уведомлений)

```typescript
// notifications/events/schedule-changed.event.ts
export class ScheduleChangedEvent {
  constructor(
    public readonly lessonId: string,
    public readonly universityId: string,
    public readonly changeType: LessonChangeType,
    public readonly oldValues: Record<string, unknown>,
    public readonly newValues: Record<string, unknown>,
  ) {}
}

// schedule.service.ts
@Injectable()
export class ScheduleService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async detectChanges(lessonId: string, newData: NormalizedLesson[]): Promise<void> {
    const changes = await this.changeDetector.detect(lessonId, newData);
    
    for (const change of changes) {
      await this.saveChange(change);
      
      this.eventEmitter.emit('schedule.changed', new ScheduleChangedEvent(
        lessonId,
        change.universityId,
        change.changeType,
        change.oldValues,
        change.newValues,
      ));
    }
  }
}

// notifications.module.ts
@Module({
  imports: [
    EventEmitter2.forRoot(),
  ],
})
export class NotificationsModule implements OnModuleInit {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.eventEmitter.on('schedule.changed', this.handleScheduleChanged.bind(this));
  }
}
```

## Middleware

```typescript
// common/middleware/university.middleware.ts
@Injectable()
export class UniversityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = req.user as JwtPayload;
    if (user?.universityId) {
      req.query.university_id = user.universityId;
    }
    next();
  }
}

// app.module.ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UniversityMiddleware)
      .forRoutes('*');
  }
}
```

## Конфигурация

```typescript
// config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'napare',
  password: process.env.DB_PASSWORD || 'napare',
  database: process.env.DB_NAME || 'napare',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
```

## Тестирование

```
apps/backend/test/
├── auth/
│   ├── auth.service.spec.ts
│   └── auth.controller.e2e-spec.ts
├── schedule/
│   ├── schedule.service.spec.ts
│   └── change-detector.service.spec.ts
├── pair-space/
│   ├── pair-space.service.spec.ts
│   └── pair-space.controller.e2e-spec.ts
├── absences/
│   ├── absences.service.spec.ts
│   └── absence-validator.spec.ts
├── notifications/
│   └── notifications.service.spec.ts
└── fixtures/
    ├── user.fixture.ts
    ├── lesson.fixture.ts
    └── university.fixture.ts
```

## ENV переменные

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=napare
DB_PASSWORD=napare
DB_NAME=napare

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=60d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# S3
S3_ENDPOINT=localhost:9000
S3_BUCKET=napare
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Push
FCM_PROJECT_ID=your-project-id
FCM_PRIVATE_KEY=your-private-key
APNS_KEY_ID=your-key-id
APNS_TEAM_ID=your-team-id

# Sentry
SENTRY_DSN=https://your-sentry-dsn

# PostHog
POSTHOG_API_KEY=your-api-key
```