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
| Career           | `/api/v1/career`                         | Student/employer workflows, university-scoped career-center queues, paginated task/workflow/partnership/test/notice/lookup/admission/portfolio lists, exact unread notice count and career aggregates; public portfolio cases are consent-filtered before pagination; legacy tests array and overview responses remain compatible |
| Search           | `/api/v1/search`                            | Авторизованный Spotlight по данным, доступным роли пользователя                                                |
| Absences         | `/api/v1/absences`, `/api/v1/curator`      | [modules/absences.md](../modules/absences.md)                                                                   |
| Curation         | `/api/v1/curation`                       | Дополнительные назначения на существующие аккаунты; [контракт](../product/account-curatorship.md) |
| Notifications    | `/api/v1/notifications`, `/api/v1/devices` | [modules/notifications.md](../modules/notifications.md)                                                         |
| Events           | `/api/v1/events`                           | `GET /events`, SSE `GET /events/stream` — лента событий текущего пользователя                                   |
| Admin            | `/api/v1/admin`, `/api/v1/superadmin`      | [modules/admin.md](../modules/admin.md)                                                                         |
| Platform data    | `/api/v1/platform-data`                   | Глобальный поиск и исправление отсутствий, посещаемости и решений по отсутствиям; `student-data.read/write`, причина и аудит |
| Platform records | `/api/v1/platform-records`                | Поиск пользователей и управление личными настройками, избранным, заметками и прогрессом; отдельные `personal-data.read/write`, проверка связей и аудит |
| Platform homework | `/api/v1/platform-homework`                | Глобальный поиск сдач и исправления статуса, времени, ссылки и комментария; отдельные `homework-data.read/write`, просмотр и изменения аудируются, правка требует причины; оценок нет |
| Platform notifications | `/api/v1/platform-notifications`                | Поиск/исправление уведомлений и inbox-записей, просмотр/отзыв push-устройств без токенов; `notification-data.read/write`, действия аудируются, изменения требуют причины |
| Platform curation | `/api/v1/platform-curation` | Глобальный поиск назначений, выдача и мягкий отзыв кураторства по `curation-data.read/write`; область проверяется по вузу, история и действия аудируются |
| Platform attendance QR | `/api/v1/platform-attendance-qr` | Поиск метаданных QR-сессий без секрета и отзыв действующей сессии; `attendance-qr.read/revoke`, аудит и обязательная причина |
| Platform PairSpace | `/api/v1/platform-pair-space` | Глобальный поиск/проверка пространств пар и объявлений; исправление активности пространства, текста/закрепления объявления; `pairspace-content.read/write`, tenant-проверки и аудит |
| Platform academic | `/api/v1/platform-academic` | Поиск occurrences, legacy-занятий, доменных событий, курсов и серий; reasoned correction, история и обратимое скрытие AcademicEvent; `academic-data.read/write` |
| Platform events | `/api/v1/platform-events` | Поиск и просмотр системных событий с очищенными полями; `events-data.read`, просмотр пишется в аудит |
| Platform attachments | `/api/v1/platform-attachments` | Реестр ссылок на вложения PairSpace, обратимое скрытие/восстановление; `attachments-data.read/write`, URL очищаются, физические файлы не удаляются |
| Platform organization | `/api/v1/platform/organization` | Поиск факультетов и групп выбранного вуза и изменение с обязательной причиной через `universities.read/write`; внешний ID группы доступен только для чтения, кураторы управляются отдельно |
| Platform career | `/api/v1/platform-career` | Профили, практика, компании, партнёрства, задачи, назначения карьерных прав, тесты, попытки, портфолио, отзывы, уведомления и доступность; изменения защищены `career-data.read/write`, отзыв/передача владения и правки требуют причины, чувствительный контент открывается с аудитом |
| Academic context | `/api/v1/academic`                         | [modules/academic.md](../modules/academic.md) — 15 маршрутов, каждый под `@RequiresPermission`                  |
| App & Health     | `/api/v1/app`, `/api/v1/health`            | `GET /app` — информация об API; `GET /health` проверяет API и базу данных, возвращает `503`, если БД недоступна |

Career content administration uses `GET /api/v1/platform-career/portfolios`, `/portfolios/:id`, and `PATCH /portfolios/:id`; reviews use `/reviews` and `/reviews/:id`; career notices use `/notices` and `/notices/:id`. Lists and detail reads require `career-data.read`; changes require `career-data.write` and a reason. Updating case text makes it private. Updating a review withdraws its publication consent and hides its linked case. Every content read and mutation is audited.

Career planning settings are available through `GET /api/v1/platform-career/availability`, `GET /availability/:studentId`, and `PATCH /availability/:studentId`. The server reuses the student-facing IANA time-zone, work-window and date-range validation, keeps the original university link, and audits searches, detail reads and reasoned changes.

Career selector lookups use `GET /api/v1/career/universities?workspace=employer&offset=0&limit=20&q=...` and `GET /api/v1/career/center/assignable-staff?offset=0&limit=20&q=...`. Both return `{items,total,offset,limit,hasMore}` with `limit` capped at 50 and deterministic ordering. The employer list contains only `active` universities, ordered by name then ID; `pending` and `inactive` universities are omitted from selectors, while existing create/partnership POST validation remains unchanged. The assignable-staff list checks strict center-administrator permission for the actor's own university before reading users, and returns active same-university accounts with roles that the existing membership mutation can target. Career staff without administrator permission cannot use the list or promote memberships.

Student career history uses authenticated `GET /api/v1/career/student/admissions` and `/student/portfolio`. Admissions are owner/university-scoped, ordered `createdAt DESC, id DESC`, paginated up to 50, and include the full approved-skill set for task eligibility. The private portfolio endpoint paginates only own cases with accepted work, task, and review; its accepted-work count and review count/average cover the full owned set, independent of the current page. Public `GET /api/v1/career/accounts/portfolio/:studentId/cases` pages only active students' published cases with accepted owned work and `publishAllowed=true`; the same 404 is returned for missing, inactive, and no-visible-case portfolios, and totals count only consented visible cases. The legacy overview and public portfolio endpoint remain available.

Решения по отсутствиям доступны через `GET /api/v1/platform-data/absence-confirmations`, `GET /api/v1/platform-data/absence-confirmations/:id` и `PATCH /api/v1/platform-data/absence-confirmations/:id`. Используются разрешения `student-data.read/write`; поиск записывает наличие `q`, но не его значение. Просмотр и исправления аудируются с оператором, IP и user-agent; исправление требует причины и сохраняет старые и новые значения. Решение остаётся связано с исходным отсутствием, студентом и вузом, а `curatorId` сохраняется.

Назначения кураторов доступны через `GET /api/v1/platform-curation/assignments?status=active|revoked|all`, `GET /api/v1/platform-curation/assignments/:id`, `GET /api/v1/platform-curation/groups?universityId=...`, `GET /api/v1/platform-curation/candidates?universityId=...`, `POST /api/v1/platform-curation/assignments` и `PATCH /api/v1/platform-curation/assignments/:id/revoke`. Чтение требует `curation-data.read`, выдача и отзыв — `curation-data.write`; операции записи требуют `reason`. Назначение проверяет группу, университет, активность аккаунта и допустимую роль на сервере. Отзыв сохраняет строку назначения и его историю. Поиск и просмотр аудируются; аудит изменений содержит старые/новые значения, причину, IP и user-agent.

Системные события доступны через `GET /api/v1/platform-events` и `GET /api/v1/platform-events/:id` с разрешением `events-data.read`. Поиск фильтрует по `q`, вузу, типу, периоду и важности; ответ содержит только безопасные метаданные и allowlist полей payload. Список получателей, полный payload и ключ идемпотентности не возвращаются. Поиск и открытие карточки события записываются в аудит без исходного текста поискового запроса.

Реестр вложений PairSpace доступен через `GET /api/v1/platform-attachments?status=active|revoked|all`, `GET /api/v1/platform-attachments/:id`, `PATCH /api/v1/platform-attachments/:id/revoke` и `PATCH /api/v1/platform-attachments/:id/restore`. Чтение требует `attachments-data.read`, отзыв/восстановление — `attachments-data.write` и `{reason}`. Возвращается очищенный `fileLocation` (HTTP(S) origin и path без credentials, query и hash); физический файл не меняется. Отзыв скрывает вложение в обычных ответах PairSpace, но ранее известная прямая ссылка может продолжить работать. Восстановление возвращает запись в PairSpace. Поиск, просмотр и действия аудируются.

---

## Примеры нестандартных кейсов

См. [api/examples.md](examples.md).

## Управление платформой

Только владелец: `POST /api/v1/platform/trust/emergency-revoke` с текущим паролем и точной фразой подтверждения. Атомарно отзывает делегированные платформенные назначения и сессии технических аккаунтов, сохраняя доступ владельца; подробные границы — в контракте ниже.

Новые маршруты /api/v1/platform: access, services, services/:service/logs, jobs, jobs/:id, accounts, accounts/:id, accounts/:id/password, accounts/:id/revoke-sessions, accounts/:id/identity/max/unlink, accounts/:id/identity/telegram/revoke, groups?universityId=..., permissions, settings, universities и audit. GET public-settings доступен без входа; остальные проверяют владельца или отдельные разрешения на сервере. Подробная карточка аккаунта использует accounts.read; изменение профиля, роли, статуса и связей требует accounts.write. Отзыв MAX-привязки требует `identity-links.write` и причину, защищает оператора и владельца, завершает сессии целевого пользователя и не раскрывает внешний ID. Личные записи доступны через `/api/v1/platform-records/users` и подмаршруты `preferences`, `favorites`, `lesson-notes`, `homework-progress`; чтение/изменение требуют `personal-data.read/write`. Сдачи домашних заданий доступны через `GET /api/v1/platform-homework/submissions`, `GET /api/v1/platform-homework/submissions/:id` и `PATCH /api/v1/platform-homework/submissions/:id`; чтение требует `homework-data.read`, исправления — `homework-data.write` и причину, просмотр и исправления записываются в аудит, оценок нет. Уведомления и inbox доступны через `GET /api/v1/platform-notifications/records?kind=notification|inbox`, `GET /api/v1/platform-notifications/records/:kind/:id` и `PATCH /api/v1/platform-notifications/records/:kind/:id`; чтение требует `notification-data.read`, исправления — `notification-data.write` и причину, поиск, просмотр и старые/новые значения исправлений записываются в аудит. Push-устройства доступны через `GET /api/v1/platform-notifications/devices` без выдачи токенов и `PATCH /api/v1/platform-notifications/devices/:id/revoke` с причиной; поиск и отзыв аудируются, отзыв только устанавливает `isActive=false` без удаления записи. Карьерные профили, допуски, отклики и работы доступны через `/api/v1/platform-career`; разделы карьерных компаний, назначений и тестов добавлены в тот же API. Чтение требует `career-data.read`, изменения — `career-data.write` и причину; просмотр правильных ответов теста отдельно аудируется. Обсуждения доступны через `/api/v1/platform-discussions/messages` и `/messages/:id`; правка текста и обратимая модерация требуют `discussion-data.write`. Выдача `/platform/audit` ограничивает снимки личных, карьерных, дискуссионных, сдач домашних заданий, уведомлений и аккаунтных данных отдельными разрешениями. [Контракт и ограничения](../product/platform-control.md), [установка](../deployment/platform-control.md).
