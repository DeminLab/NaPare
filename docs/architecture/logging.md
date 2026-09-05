# Logging and Monitoring Strategy

Стратегия логирования и мониторинга для всего приложения.

---

## 1. Принципы

1. **Структурированные логи** — JSON формат
2. **Контекст** — request ID, user ID, timestamp
3. **Уровни** — error > warn > info > debug
4. **Безопасность** — не логировать пароли, токены, ПДн
5. **Производительность** — не блокировать основной поток

---

## 2. Log Levels

| Уровень | Использование | Пример |
|---------|---------------|--------|
| `error` | Критические ошибки | Падение БД, ошибка оплаты |
| `warn` | Предупреждения | Rate limit, deprecated API |
| `info` | Бизнес-события | Регистрация, вход, публикация ДЗ |
| `debug` | Отладочная информация | Запрос к БД, вызов внешнего API |

---

## 3. Structured Log Format

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "context": "ScheduleService",
  "message": "Schedule synced successfully",
  "requestId": "req-uuid",
  "userId": "user-uuid",
  "universityId": "uni-uuid",
  "duration": 1234,
  "metadata": {
    "lessonsCount": 150,
    "changesDetected": 3
  }
}
```

---

## 4. Backend Logging (NestJS)

### Logger Service

```typescript
// common/logger/logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AppLogger implements LoggerService {
  private context: string;

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, metadata?: Record<string, unknown>) {
    this.write('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.write('warn', message, metadata);
  }

  error(message: string, trace?: string, metadata?: Record<string, unknown>) {
    this.write('error', message, { ...metadata, trace });
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      this.write('debug', message, metadata);
    }
  }

  private write(level: string, message: string, metadata?: Record<string, unknown>) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...metadata,
    };

    console.log(JSON.stringify(log));
  }
}
```

### Request Logging Interceptor

```typescript
// common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new AppLogger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = uuid();
    const startTime = Date.now();

    // Добавляем requestId к запросу
    request.requestId = requestId;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log('Request completed', {
            requestId,
            method: request.method,
            path: request.url,
            statusCode: context.switchToHttp().getResponse().statusCode,
            duration,
            userId: request.user?.id,
            ip: request.ip,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error('Request failed', error.stack, {
            requestId,
            method: request.method,
            path: request.url,
            statusCode: error.status || 500,
            duration,
            userId: request.user?.id,
            ip: request.ip,
          });
        },
      }),
    );
  }
}
```

### Business Event Logging

```typescript
// common/logger/business-logger.ts
@Injectable()
export class BusinessLogger {
  private readonly logger = new AppLogger('Business');

  userRegistered(userId: string, universityId: string) {
    this.logger.log('User registered', {
      userId,
      universityId,
      event: 'user.registered',
    });
  }

  userLoggedIn(userId: string, method: string) {
    this.logger.log('User logged in', {
      userId,
      method,
      event: 'user.logged_in',
    });
  }

  homeworkCreated(teacherId: string, lessonId: string, title: string) {
    this.logger.log('Homework created', {
      teacherId,
      lessonId,
      title,
      event: 'homework.created',
    });
  }

  absenceStatusCreated(studentId: string, type: string, affectedLessons: number) {
    this.logger.log('Absence status created', {
      studentId,
      type,
      affectedLessons,
      event: 'absence.created',
    });
  }

  scheduleSyncStarted(universityId: string) {
    this.logger.log('Schedule sync started', {
      universityId,
      event: 'schedule.sync_started',
    });
  }

  scheduleSyncCompleted(universityId: string, lessonsCount: number, changesCount: number) {
    this.logger.log('Schedule sync completed', {
      universityId,
      lessonsCount,
      changesCount,
      event: 'schedule.sync_completed',
    });
  }
}
```

---

## 5. Мониторинг

### Health Check

```typescript
// health/health.controller.ts
@Controller('api/v1/health')
export class HealthController {
  @Get()
  async check(@Req() req) {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkS3(),
    ]);

    const result = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '0.1.0',
      checks: {
        database: checks[0].status === 'fulfilled' ? 'ok' : 'error',
        redis: checks[1].status === 'fulfilled' ? 'ok' : 'error',
        s3: checks[2].status === 'fulfilled' ? 'ok' : 'error',
      },
    };

    const allOk = Object.values(result.checks).every((v) => v === 'ok');
    return result;
  }

  private async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis() {
    await this.redis.ping();
  }

  private async checkS3() {
    await this.s3.headBucket({ Bucket: process.env.S3_BUCKET });
  }
}
```

### Metrics Endpoint

```typescript
// metrics/metrics.controller.ts
@Controller('api/v1/metrics')
export class MetricsController {
  @Get()
  async getMetrics() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      activeConnections: this.getActiveConnections(),
      requestsPerMinute: this.getRequestsPerMinute(),
      errorRate: this.getErrorRate(),
    };
  }
}
```

### Prometheus Metrics

```typescript
// common/metrics/prometheus.service.ts
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class PrometheusService {
  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  readonly httpRequestTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  readonly activeUsers = new Gauge({
    name: 'active_users_total',
    help: 'Number of active users',
  });

  readonly scheduleSyncDuration = new Histogram({
    name: 'schedule_sync_duration_seconds',
    help: 'Duration of schedule sync operations',
    labelNames: ['university_id', 'status'],
  });

  readonly pushNotificationsSent = new Counter({
    name: 'push_notifications_sent_total',
    help: 'Total number of push notifications sent',
    labelNames: ['type', 'platform', 'status'],
  });
}
```

---

## 6. Sentry Integration

### Backend

```typescript
// main.ts
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new ProfilingIntegration(),
  ],
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  beforeSend(event) {
    // Фильтруем ошибки валидации
    if (event.exception?.values?.[0]?.type === 'ValidationError') {
      return null;
    }
    // Фильтруем ошибки сети
    if (event.exception?.values?.[0]?.type === 'NetworkError') {
      return null;
    }
    return event;
  },
});
```

### Mobile (Flutter)

```dart
// main.dart
import 'package:sentry_flutter/sentry_flutter.dart';

void main() async {
  await SentryFlutter.init(
    (options) {
      options.dsn = 'YOUR_SENTRY_DSN';
      options.tracesSampleRate = 0.2;
      options.attachScreenshot = true;
      options.sendDefaultPii = false;
    },
    appRunner: () => runApp(MyApp()),
  );
}
```

---

## 7. PostHog Analytics

### Backend Events

```typescript
// common/analytics/posthog.service.ts
import PostHog from 'posthog-node';

@Injectable()
export class PostHogService {
  private client: PostHog;

  constructor() {
    this.client = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST,
    });
  }

  userRegistered(userId: string, universityId: string, role: string) {
    this.client.capture({
      distinctId: userId,
      event: 'user_registered',
      properties: {
        universityId,
        role,
      },
    });
  }

  lessonViewed(userId: string, lessonId: string) {
    this.client.capture({
      distinctId: userId,
      event: 'lesson_viewed',
      properties: { lessonId },
    });
  }

  homeworkSubmitted(studentId: string, homeworkId: string) {
    this.client.capture({
      distinctId: studentId,
      event: 'homework_submitted',
      properties: { homeworkId },
    });
  }

  absenceStatusCreated(studentId: string, type: string) {
    this.client.capture({
      distinctId: studentId,
      event: 'absence_status_created',
      properties: { type },
    });
  }
}
```

---

## 8. Что логировать

| Событие | Уровень | Метрики |
|---------|---------|---------|
| HTTP запрос | info | method, path, status, duration |
| Ошибка HTTP | error | method, path, status, error |
| Регистрация | info | userId, universityId, role |
| Вход | info | userId, method |
| Выход | info | userId |
| Просмотр расписания | debug | userId, dateRange |
| Публикация ДЗ | info | teacherId, lessonId |
| Сдача ДЗ | info | studentId, homeworkId |
| Установка отсутствия | info | studentId, type, period |
| Подтверждение отсутствия | info | absenceId, curatorId |
| Загрузка расписания | info | universityId, lessonsCount |
| Синхронизация расписания | info | universityId, changesCount |
| Отправка push | info | userId, type, platform |
| Ошибка push | warn | userId, type, error |
| Ошибка БД | error | query, error |
| Rate limit | warn | ip, path, limit |

---

## 9. Что НЕ логировать

| Тип данных | Причина |
|------------|---------|
| Пароли | Безопасность |
| JWT токены | Безопасность |
| SMS коды | Безопасность |
| Номера телефонов (полные) | 152-ФЗ |
| Причины болезней | 152-ФЗ, конфиденциальность |
| ФИО (в debug логах) | 152-ФЗ |

### Маскирование данных

```typescript
// common/utils/mask.ts
export function maskPhone(phone: string): string {
  return phone.replace(/(\+7)(\d{3})(\d{3})(\d{2})(\d{2})/, '$1***$3**$5');
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

export function maskToken(token: string): string {
  return `${token.slice(0, 10)}...${token.slice(-4)}`;
}
```

---

## 10. Дашборды Grafana

### Основные панели

| Панель | Метрика | Время |
|--------|---------|-------|
| Request Rate | req/sec | 1 час |
| Error Rate | 5xx % | 1 час |
| Latency p95 | ms | 1 час |
| Active Users | count | 24 часа |
| Database Connections | count | 1 час |
| Redis Memory | MB | 24 часа |
| Push Notifications | count | 24 часа |
| Schedule Syncs | count | 7 дней |

---

## 11. См. также

- [ops/monitoring.md](../ops/monitoring.md) — настройка мониторинга
- [ops/cicd.md](../ops/cicd.md) — CI/CD pipeline
- [architecture/error-handling.md](error-handling.md) — обработка ошибок
