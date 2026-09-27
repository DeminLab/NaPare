# Error Handling Strategy

Единая стратегия обработки ошибок во всём приложении.

---

## 1. Принципы

1. **Единый формат** ошибок для всех API
2. **Информативные сообщения** для клиентов
3. **Детальные логи** для разработчиков
4. **Безопасность** — не раскрывать внутренности системы
5. **Градация** — warning vs error vs critical

---

## 2. Backend (NestJS)

### HTTP Exception Filter

Реальный фильтр (`common/filters/http-exception.filter.ts`) пишет лог, формирует
**плоское** тело ответа и маппит HTTP-статус в код:

```typescript
// common/filters/http-exception.filter.ts
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
}
```

Ответ (та же модель объявлена в `common/dto/api-error-response.dto.ts`):

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": ["email must be an email"],
  "timestamp": "2026-09-14T12:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

### Error Codes

Файла `common/errors/error-codes.ts` нет — коды выводятся из статуса в
`AllExceptionsFilter.codeForStatus()` и из `body.code`:

| Код | Когда |
|-----|-------|
| `VALIDATION_ERROR` | Ответ валидации NestJS пришёл массивом `message` (400) |
| `BAD_REQUEST` | 400 без тела валидации |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `RATE_LIMITED` | 429 (Throttler) |
| `HTTP_ERROR` | любой другой неизвестный статус 4xx/5xx |
| `INTERNAL_SERVER_ERROR` | 500 и не-`HttpException` ошибки |

### Business Errors

Своего класса `BusinessError` в коде нет — сервисы бросают стандартные
исключения NestJS, фильтр приводит их к единому формату:

```typescript
// admin/admin.service.ts
if (await this.usersService.findByEmail(data.email.trim())) {
  throw new ConflictException('Пользователь с такой почтой уже существует');
}

// schedule/schedule.service.ts
throw new NotFoundException(`Lesson with id ${id} not found`);

// common/guards/roles.guard.ts
throw new ForbiddenException('Insufficient permissions');
```

### Ошибки БД (TypeORM)

Prisma в проекте не используется — ORM это TypeORM. Ошибки БД приходят как
`QueryFailedError` и доходят до фильтра как не-`HttpException`, то есть получают
статус 500 и код `INTERNAL_SERVER_ERROR` (стек пишется в лог через
`logger.error`). Уникальные ограничения проверяются заранее в сервисах и
превращаются в `ConflictException` (409 / `CONFLICT`) — например, проверка
существования email в `admin.service.ts`.

Следствия:

- не нужно обрабатывать коды вроде `P2002` — их просто нет;
- миграции выполняются TypeORM (`pnpm --filter @napare/backend typeorm:migration:run`),
  а `synchronize: true` включается только вне production (`app.module.ts`).

---

## 3. Client Error Handling

> Примечание: мобильного клиента (Flutter) в репозитории нет — см.
> [mobile-architecture.md](mobile-architecture.md) (целевая спецификация).
> Фрагменты ниже показывают разбор реального формата ответа API.

### Mobile (Flutter)

```dart
// core/api/api_exception.dart
class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  final List<Map<String, dynamic>>? details;

  ApiException({
    required this.statusCode,
    required this.code,
    required this.message,
    this.details,
  });

  @override
  String toString() => 'ApiException($statusCode: $code - $message)';
}

// core/api/api_client.dart
class ApiClient {
  Future<T> request<T>(Future<T> Function() fn) async {
    try {
      return await fn();
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  ApiException _handleDioError(DioException e) {
    if (e.response?.data != null) {
      // Тело ошибки плоское: { statusCode, code, message, details?, timestamp, path }
      final data = e.response!.data as Map<String, dynamic>;
      return ApiException(
        statusCode: e.response!.statusCode!,
        code: data['code'] as String? ?? 'HTTP_ERROR',
        message: data['message'] as String? ?? 'Ошибка',
        details: (data['details'] as List?)?.cast<Map<String, dynamic>>(),
      );
    }

    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return ApiException(
        statusCode: 0,
        code: 'TIMEOUT',
        message: 'Нет подключения к серверу',
      );
    }

    if (e.type == DioExceptionType.connectionError) {
      return ApiException(
        statusCode: 0,
        code: 'NO_CONNECTION',
        message: 'Нет подключения к интернету',
      );
    }

    return ApiException(
      statusCode: 0,
      code: 'UNKNOWN',
      message: 'Неизвестная ошибка',
    );
  }
}
```

### UI Error States

```dart
// Универсальный виджет для ошибок
class ErrorWidget extends StatelessWidget {
  final String message;
  final String? code;
  final VoidCallback? onRetry;

  const ErrorWidget({
    required this.message,
    this.code,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: AppColors.error),
          SizedBox(height: AppSpacing.lg),
          Text(message, style: AppTextStyles.h3, textAlign: TextAlign.center),
          if (code != null) ...[
            SizedBox(height: AppSpacing.sm),
            Text('Код: $code', style: AppTextStyles.bodySmall),
          ],
          if (onRetry != null) ...[
            SizedBox(height: AppSpacing.xl),
            ElevatedButton(
              onPressed: onRetry,
              child: Text('Повторить'),
            ),
          ],
        ],
      ),
    );
  }
}
```

### Web (Next.js)

В веб-приложениях реальные клиенты (`apps/web-*/src/lib/api.ts`) работают на
`fetch` и читают плоское поле `message` (`data?.message || fallback`).
Иллюстративный axios-вариант разбора единого формата:

```typescript
// lib/api-client.ts
import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ statusCode: number; code: string; message: string; details?: string[] }>) => {
    if (error.response?.data?.code) {
      const { code, message, details } = error.response.data;
      throw new ApiError(error.response.status, code, message, details);
    }
    throw new ApiError(0, 'UNKNOWN', 'Неизвестная ошибка');
  }
);

// hooks/use-api.ts
export function useApi() {
  const queryClient = useQueryClient();

  const handleError = (error: unknown) => {
    if (error instanceof ApiError) {
      switch (error.code) {
        case 'UNAUTHORIZED':
          // Редирект на логин
          router.push('/login');
          break;
        case 'RATE_LIMITED':
          toast.error('Слишком много запросов. Попробуйте позже.');
          break;
        default:
          toast.error(error.message);
      }
    }
  };

  return { handleError };
}
```

---

## 4. Offline Handling

### Mobile

```dart
// core/network/network_info.dart
class NetworkInfo {
  final Connectivity _connectivity;

  Stream<bool> get onConnectivityChanged =>
      _connectivity.onConnectivityChanged.map((result) => result != ConnectivityResult.none);

  Future<bool> get isConnected async {
    final result = await _connectivity.checkConnectivity();
    return result != ConnectivityResult.none;
  }
}

// core/cache/cache_manager.dart
class CacheManager {
  Future<T?> getCachedOrFetch<T>(
    String key,
    Future<T> Function() fetchFn,
    Duration ttl,
  ) async {
    try {
      return await fetchFn();
    } catch (e) {
      final cached = await _getFromCache(key);
      if (cached != null && !_isExpired(cached.timestamp, ttl)) {
        return cached.data;
      }
      rethrow;
    }
  }
}
```

### Web

```typescript
// lib/hooks/use-offline.ts
export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOffline;
}
```

---

## 5. Retry Logic

### Exponential Backoff

```typescript
// common/utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    retryOn?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const { maxRetries = 3, delay = 1000, backoff = 2, retryOn = () => true } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(backoff, attempt)));
    }
  }

  throw new Error('Max retries exceeded');
}

// Использование
const data = await withRetry(
  () => scheduleService.getMySchedule(),
  {
    maxRetries: 2,
    retryOn: (error) => error instanceof ApiException && error.statusCode === 0,
  },
);
```

---

## 6. Мониторинг ошибок

### Sentry Integration

```typescript
// main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Не отправлять ошибки валидации
    if (event.exception?.values?.[0]?.type === 'ValidationError') {
      return null;
    }
    return event;
  },
});
```

### Error Metrics

| Метрика | Описание | Алерт |
|---------|----------|-------|
| `http.server.errors` | Счётчик ошибок по коду | > 1% за 5 мин |
| `http.server.latency` | Латентность | p95 > 1 сек |
| `business.errors` | Бизнес-ошибки | > 10/мин |
| `orm.errors` | Ошибки запросов TypeORM | > 5/мин |

---

## 7. См. также

- [api/README.md](../api/README.md) — формат ошибок API
- [ops/monitoring.md](../ops/monitoring.md) — мониторинг
- [security/threat-model.md](../security/threat-model.md) — модель угроз
