# API — OpenAPI = Source of Truth

## Принцип

OpenAPI-спецификация **генерируется из кода** (NestJS декораторы) и является единственным источником правды для контрактов API.

**Не рисовать OpenAPI вручную.** Реализовывать эндпоинты в NestJS → Swagger обновляется автоматически.

---

## Доступ к документации

| Среда | URL |
|-------|-----|
| Local | `http://localhost:3000/api/v1/docs` |
| Staging | `https://staging.napare.ru/api/v1/docs` |
| Production | `https://napare.sano.ru/api/v1/docs` |

---

## Версионирование

Все endpoints начинаются с `/api/v1/`.

---

## Формат ошибок

Единый формат для всех ошибок:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Неверные входные данные",
    "details": [
      { "field": "email", "message": "Неверный формат email" }
    ]
  }
}
```

| Код | HTTP Status | Описание |
|-----|-------------|----------|
| `VALIDATION_ERROR` | 400 | Неверные входные данные |
| `INVALID_CODE` | 400 | Неверный SMS/email код |
| `UNAUTHORIZED` | 401 | Не авторизован |
| `FORBIDDEN` | 403 | Нет доступа |
| `NOT_FOUND` | 404 | Не найдено |
| `RATE_LIMIT_EXCEEDED` | 429 | Слишком много запросов |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка |

---

## Пагинация

```
GET /api/v1/schedule/my?page=1&limit=20&sort=startTime&order=asc
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

| Группа | Префикс | Модуль |
|--------|---------|--------|
| Auth & Users | `/api/v1/auth`, `/api/v1/users` | [modules/auth.md](../modules/auth.md) |
| Schedule | `/api/v1/schedule` | [modules/schedule.md](../modules/schedule.md) |
| Pair Space | `/api/v1/pair-spaces` | [modules/pair-space.md](../modules/pair-space.md) |
| Absences | `/api/v1/absences`, `/api/v1/curator` | [modules/absences.md](../modules/absences.md) |
| Notifications | `/api/v1/notifications`, `/api/v1/devices` | [modules/notifications.md](../modules/notifications.md) |
| Admin | `/api/v1/admin`, `/api/v1/superadmin` | [modules/admin.md](../modules/admin.md) |

---

## Примеры нестандартных кейсов

См. [api/examples.md](examples.md).
