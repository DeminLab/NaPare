# ADR-0003: JWT-авторизация

## Статус
Принято

## Контекст
Нужна stateless-авторизация для мобильного приложения, web и MAX Mini-App. Токены должны быть безопасными и удобными для пользователя.

## Решение
Использовать **JWT с двумя токенами**:

### Access Token
- Срок жизни: 15–30 минут
- Содержит: `userId`, `universityId`, `roles[]`
- Используется для авторизации запросов
- Хранится в памяти (не в localStorage)

### Refresh Token
- Срок жизни: 30–60 дней
- Используется для получения нового access token
- Хранится в secure storage (flutter_secure_storage / httpOnly cookie)

### Эндпоинты
```
POST /api/v1/auth/request-code    # Отправка SMS/email кода
POST /api/v1/auth/verify-code     # Верификация кода → пара токенов
POST /api/v1/auth/refresh         # Обновление access token
POST /api/v1/auth/logout          # Инвалидация refresh token
```

## Реализация

### NestJS
```typescript
// JWT Strategy
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return { 
      userId: payload.sub, 
      universityId: payload.universityId,
      roles: payload.roles 
    };
  }
}
```

### Клиент (Flutter)
```dart
class AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _storage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Попытка обновить токен
      _refreshToken().then((_) {
        // Повторить запрос
      });
    }
    handler.next(err);
  }
}
```

## Безопасность
1. Refresh token хранится в secure storage (не в localStorage)
2. Access token не сохраняется на диск
3. При выходе — инвалидация refresh token
4. Роли проверяются через Guards: `@Roles('teacher')`

## Преимущества
1. Stateless — не нужно хранить сессии
2. Масштабируемость — любой экземпляр может проверить токен
3. Удобство для мобильных клиентов
4. Поддержка ролей и university_id

## Связанные решения
- ADR-0001: Модульный монолит
- ADR-0002: Мультивузовость