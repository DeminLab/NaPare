# API — OpenAPI = Source of Truth

## Принцип

OpenAPI-спецификация **генерируется из кода** (NestJS декораторы) и является единственным источником правды для контрактов API.

**Не рисовать OpenAPI вручную.** Реализовывать эндпоинты в NestJS → Swagger обновляется автоматически. Для комплекта сдачи скачивайте актуальную спецификацию с развернутого API через [`scripts/export-case-openapi.sh`](../../scripts/export-case-openapi.sh).

---

## Доступ к документации

| Среда      | URL                                     |
| ---------- | --------------------------------------- |
| Local      | `http://localhost:3000/api/v1/docs`     |
| Staging    | URL, настроенный в GitHub Environment secret `STAGING_URL` |
| Production | `https://napare.sano.ru/api/v1/docs` |

Hostname staging не зафиксирован в репозитории и зависит от настроек окружения.

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

Поле `details` присутствует только при ошибке валидации (список сообщений class-validator). Код `RATE_LIMITED` возвращается активным throttler guard при превышении лимита.

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

**Rate limiting:** `ThrottlerGuard` активен глобально. Стандартный лимит — `RATE_LIMIT_MAX` запросов за `RATE_LIMIT_WINDOW_MS` на IP; `/auth/login`, `/auth/portal-login`, `/auth/max` и `/auth/max/link` ограничены дополнительно 10 запросами за 60 секунд, `/auth/telegram/link` — 3 запросами за 60 секунд. В production Express доверяет двум прокси: host Nginx и Docker Nginx.

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
| Favorites        | `/api/v1/users/me/favorites`                | Student-only groups/teachers saved in the current tenant and account; see [contracts](contracts.md) |
| Schedule         | `/api/v1/schedule`                         | [modules/schedule.md](../modules/schedule.md)                                                                   |
| My Day           | `/api/v1/my-day`                           | `GET /my-day` — агрегат «Главный экран» (lessons, pairSpaces, absences, notifications, summary)                 |
| Pair Space       | `/api/v1/pair-spaces`                      | [modules/pair-space.md](../modules/pair-space.md)                                                               |
| Search           | `/api/v1/search`                            | Авторизованный Spotlight по данным, доступным роли пользователя                                                |
| Absences         | `/api/v1/absences`, `/api/v1/curator`      | [modules/absences.md](../modules/absences.md)                                                                   |
| Curation         | `/api/v1/curation`                       | Дополнительные назначения на существующие аккаунты; [контракт](../product/account-curatorship.md) |
| Notifications    | `/api/v1/notifications`, `/api/v1/devices` | [modules/notifications.md](../modules/notifications.md)                                                         |
| Events           | `/api/v1/events`                           | `GET /events`, SSE `GET /events/stream` — лента событий текущего пользователя                                   |
| Admin            | `/api/v1/admin`, `/api/v1/superadmin`      | [modules/admin.md](../modules/admin.md)                                                                         |
| Academic context | `/api/v1/academic`                         | [modules/academic.md](../modules/academic.md) — 15 маршрутов, каждый под `@RequiresPermission`                  |
| App & Health     | `/api/v1/app`, `/api/v1/health`            | `GET /app` — информация об API; `GET /health` проверяет API и базу данных, возвращает `503`, если БД недоступна |

---

## Примеры нестандартных кейсов

См. [api/examples.md](examples.md).

## Управление платформой

Только владелец: `POST /api/v1/platform/trust/emergency-revoke` с текущим паролем и точной фразой подтверждения. Атомарно отзывает делегированные платформенные назначения и сессии технических аккаунтов, сохраняя доступ владельца; подробные границы — в контракте ниже.

Новые маршруты /api/v1/platform: access, services, services/:service/logs, jobs, jobs/:id, accounts, accounts/:id/password, accounts/:id/revoke-sessions, permissions, settings, universities и audit. GET public-settings доступен без входа; остальные проверяют владельца или отдельные разрешения на сервере. [Контракт и ограничения](../product/platform-control.md), [установка](../deployment/platform-control.md).
