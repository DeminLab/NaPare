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

```typescript
// common/filters/http-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = this.getStatusCode(exception);
    const code = this.getErrorCode(exception);
    const message = this.getMessage(exception);
    const details = this.getDetails(exception);

    // Логируем ошибку
    this.logger.error({
      statusCode: status,
      code,
      message,
      path: request.url,
      method: request.method,
      userId: request.user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      details,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Отправляем в Sentry
    if (status >= 500) {
      Sentry.captureException(exception, {
        extra: {
          path: request.url,
          userId: request.user?.id,
        },
      });
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(details && { details }),
      },
    });
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.getPrismaStatusCode(exception);
    }
    return 500;
  }

  private getErrorCode(exception: unknown): string {
    if (exception instanceof HttpException) {
      return this.getHttpErrorCode(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.getPrismaErrorCode(exception);
    }
    return 'INTERNAL_ERROR';
  }
}
```

### Error Codes

```typescript
// common/errors/error-codes.ts
export const ERROR_CODES = {
  // Validation
  VALIDATION_ERROR: { status: 400, message: 'Неверные входные данные' },
  INVALID_PHONE: { status: 400, message: 'Неверный формат телефона' },
  INVALID_EMAIL: { status: 400, message: 'Неверный формат email' },
  INVALID_CODE: { status: 400, message: 'Неверный код' },
  CODE_EXPIRED: { status: 400, message: 'Код истёк' },

  // Auth
  UNAUTHORIZED: { status: 401, message: 'Не авторизован' },
  INVALID_CREDENTIALS: { status: 401, message: 'Неверный email или пароль' },
  TOKEN_EXPIRED: { status: 401, message: 'Токен истёк' },
  TOKEN_INVALID: { status: 401, message: 'Невалидный токен' },

  // Access
  FORBIDDEN: { status: 403, message: 'Нет доступа' },
  ACCOUNT_LOCKED: { status: 403, message: 'Аккаунт заблокирован' },

  // Not Found
  NOT_FOUND: { status: 404, message: 'Не найдено' },
  USER_NOT_FOUND: { status: 404, message: 'Пользователь не найден' },
  LESSON_NOT_FOUND: { status: 404, message: 'Пара не найдена' },
  PAIR_SPACE_NOT_FOUND: { status: 404, message: 'Пространство пары не найдено' },

  // Conflict
  ALREADY_EXISTS: { status: 409, message: 'Уже существует' },
  SCHEDULE_CONFLICT: { status: 409, message: 'Конфликт расписания' },

  // Rate Limit
  RATE_LIMIT_EXCEEDED: { status: 429, message: 'Слишком много запросов' },

  // Internal
  INTERNAL_ERROR: { status: 500, message: 'Внутренняя ошибка сервера' },
  DATABASE_ERROR: { status: 500, message: 'Ошибка базы данных' },
  EXTERNAL_SERVICE_ERROR: { status: 502, message: 'Ошибка внешнего сервиса' },
} as const;
```

### Business Errors

```typescript
// common/errors/business-error.ts
export class BusinessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

// Использование
throw new BusinessError('SCHEDULE_CONFLICT', 'Две пары в одно время', {
  lesson1Id: 'uuid1',
  lesson2Id: 'uuid2',
  time: '09:00',
});
```

### Prisma Errors

```typescript
// common/errors/prisma-error.handler.ts
export function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): never {
  switch (error.code) {
    case 'P2002':
      throw new ConflictException('Запись уже существует');
    case 'P2025':
      throw new NotFoundException('Запись не найдена');
    case 'P2003':
      throw new BadRequestException('Неверная ссылка на связанную запись');
    case 'P2014':
      throw new BadRequestException('Нарушено ограничение связей');
    default:
      throw new InternalServerErrorException('Ошибка базы данных');
  }
}
```

---

## 3. Client Error Handling

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
      final error = e.response!.data['error'];
      return ApiException(
        statusCode: e.response!.statusCode!,
        code: error['code'],
        message: error['message'],
        details: error['details']?.cast<Map<String, dynamic>>(),
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

```typescript
// lib/api-client.ts
import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Array<{ field: string; message: string }>,
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
  (error: AxiosError<{ error: { code: string; message: string; details?: any[] } }>) => {
    if (error.response?.data?.error) {
      const { code, message, details } = error.response.data.error;
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
        case 'RATE_LIMIT_EXCEEDED':
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
| `prisma.errors` | Ошибки БД | > 5/мин |

---

## 7. См. также

- [api/README.md](../api/README.md) — формат ошибок API
- [ops/monitoring.md](../ops/monitoring.md) — мониторинг
- [security/threat-model.md](../security/threat-model.md) — модель угроз
