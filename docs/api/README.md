# API — OpenAPI = Source of Truth

## Принцип

OpenAPI-спецификация **генерируется из кода** (NestJS декораторы) и является единственным источником правды для контрактов API.

**Не рисовать OpenAPI вручную.** Реализовывать эндпоинты в NestJS → Swagger обновляется автоматически.

---

## Доступ к документации

| Среда      | URL                                     |
| ---------- | --------------------------------------- |
| Local      | `http://localhost:3000/api/v1/docs`     |
| Staging    | `https://staging.napare.ru/api/v1/docs` |
| Production | `https://napare.sano.ru/api/v1/docs`    |

---

## Версионирование

Все endpoints начинаются с `/api/v1/`.

---

## Формат ошибок

Единый плоский формат (без вложенной обёртки `error`) — см. `AllExceptionsFilter`:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": ["email must be an email"],
  "timestamp": "2026-09-26T10:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

Поле `details` присутствует только при ошибке валидации (список сообщений class-validator). Остальные коды (`INVALID_CODE`, `CODE_EXPIRED`, `RATE_LIMIT_EXCEEDED`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `INTERNAL_ERROR`) в API не используются.

| Код                     | HTTP Status | Описание                                              |
| ----------------------- | ----------- | ----------------------------------------------------- |
| `VALIDATION_ERROR`      | 400         | Неверные входные данные (`details` со списком ошибок) |
| `BAD_REQUEST`           | 400         | Некорректный запрос                                   |
| `UNAUTHORIZED`          | 401         | Не авторизован                                        |
| `FORBIDDEN`             | 403         | Нет доступа                                           |
| `NOT_FOUND`             | 404         | Не найдено                                            |
| `CONFLICT`              | 409         | Конфликт (например, дубль email)                      |
| `RATE_LIMITED`          | 429         | Слишком много запросов                                |
| `HTTP_ERROR`            | прочие      | Прочие HTTP-ошибки                                    |
| `INTERNAL_SERVER_ERROR` | 500         | Внутренняя ошибка                                     |

**Rate limiting:** `ThrottlerModule` сконфигурирован (100 запросов/60 с), но `ThrottlerGuard` нигде не подключён — пер-эндпоинтные лимиты в [contracts.md](contracts.md) фактически не действуют.

---

## Пагинация

Оборачиваются **только списковые** ответы (ключи `data` + `meta`); одиночные ресурсы возвращаются без обёртки:

```
GET /api/v1/schedule/my?startDate=2026-09-14&endDate=2026-09-20&page=1&limit=20
```

Ответ:

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

Допустимые параметры пагинации — `page` и `limit` (по умолчанию 1 и 50, максимум 100). Лишние query-параметры отклоняются глобальным `ValidationPipe` (`forbidNonWhitelisted`) с кодом `VALIDATION_ERROR`.

---

## Генерация клиента

```bash
# Генерация TypeScript-клиента из OpenAPI
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3000/api/v1/docs-json \
  -g typescript-axios \
  -o packages/api-client/src
```

---

## Ключевые группы endpoints

| Группа           | Префикс                                    | Модуль                                                                                                          |
| ---------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Auth & Users     | `/api/v1/auth`, `/api/v1/users`            | [modules/auth.md](../modules/auth.md)                                                                           |
| Schedule         | `/api/v1/schedule`                         | [modules/schedule.md](../modules/schedule.md)                                                                   |
| My Day           | `/api/v1/my-day`                           | `GET /my-day` — агрегат «Главный экран» (lessons, pairSpaces, absences, notifications, summary)                 |
| Pair Space       | `/api/v1/pair-spaces`                      | [modules/pair-space.md](../modules/pair-space.md)                                                               |
| Absences         | `/api/v1/absences`, `/api/v1/curator`      | [modules/absences.md](../modules/absences.md)                                                                   |
| Notifications    | `/api/v1/notifications`, `/api/v1/devices` | [modules/notifications.md](../modules/notifications.md)                                                         |
| Events           | `/api/v1/events`                           | `GET /events`, SSE `GET /events/stream` — лента событий текущего пользователя                                   |
| Admin            | `/api/v1/admin`, `/api/v1/superadmin`      | [modules/admin.md](../modules/admin.md)                                                                         |
| Academic context | `/api/v1/academic`                         | [modules/academic.md](../modules/academic.md) — 15 маршрутов, каждый под `@RequiresPermission`                  |
| App & Health     | `/api/v1/app`, `/api/v1/health`            | `GET /app` — информация об API; `GET /health` проверяет API и базу данных, возвращает `503`, если БД недоступна |

---

## Примеры нестандартных кейсов

См. [api/examples.md](examples.md).
