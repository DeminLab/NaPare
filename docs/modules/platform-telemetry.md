# Платформенная телеметрия, аналитика и управление сессиями

> Contract-first: contract -> API -> DB -> RLS -> UX -> acceptance.

## 1. Purpose & scope

Назначение: давать Web Developer реальные данные о работе платформы — кто и как пользуется
системой, где возникают ошибки, какие сессии активны, — и давать инструменты администрирования
(отзыв сессий, блокировка аккаунта) поверх этих данных.

В объёме:

- три телеметрические таблицы (`user_sessions`, `auth_events`, `platform_events`);
- серверный перехват HTTP-вызовов (`TelemetryInterceptor`) и клиентский beacon (`POST /telemetry/events`);
- витрина аналитики для Developer (`/platform/analytics/*`, `/platform/events`, `/platform/monitored-users/*`, `/platform/sessions`);
- сам-сервис сессий пользователя (`GET /auth/sessions`, `POST /auth/sessions/:id/revoke`);
- санитизация и нормализация payload перед записью;
- retention и удаление данных вместе с аккаунтом.

Вне объёма: продуктовая аналитика по заявкам/сообщениям (это домены `requests`, `messenger`),
billing, хранилище файлов, GeoIP-обогащение IP, рекламные/маркетинговые пиксели.

Ключевые сущности: `UserSession`, `AuthEvent`, `PlatformEvent`.

Миграция: `1700000000044-PlatformTelemetry` (`apps/backend/src/migrations/`). Откат (`down`)
намеренно запрещён: таблицы содержат журналируемые данные, их удаление должно быть осознанным
ручным решением, а не побочным эффектом отката.

## 2. Actors & permissions

| Роль | Действия | Требуемые права |
| --- | --- | --- |
| Аутентифицированный пользователь | Видеть свои активные сессии, отозвать свою сессию | Аутентификация (scope `self`, без платформенных прав) |
| Оператор платформы / Developer | Дашборд загрузки | `analytics.read` |
| Оператор платформы / Developer | Журнал событий, значения фильтров, список наблюдаемых пользователей, карточка пользователя, журнал сессий | `telemetry.read` |
| Оператор платформы | Отозвать конкретную сессию, отозвать все сессии пользователя, заблокировать/разблокировать аккаунт | `accounts.write` |

Права входят в `PLATFORM_PERMISSIONS` (`apps/backend/src/platform/platform.dto.ts`) и выдаются
через `PATCH /platform/accounts/:id` (`permissions.*`). Проверка выполняется в сервисе
(`PlatformService.require(...)`), а не только в guard'е, поэтому маршрут нельзя «забыть защитить».

Доступ к аналитике открывается только платформенным аккаунтам (`PlatformService.access()`),
университетные операторы её не получают. Bootstrap-аккаунт Developer получает полный набор прав
при инициализации платформы.

## 3. API surface

Все маршруты — префикс `/api/v1`.

### 3.1 Телеметрия клиента

| Метод | Путь | Кто | Описание |
| --- | --- | --- | --- |
| POST | `/telemetry/events` | Анонимно или по JWT (`OptionalJwtAuthGuard`) | Пакет клиентских событий. Ответ `202 Accepted` с числом принятых событий — запись в БД выполняется асинхронно из буфера |

Форма тела (`ClientTelemetryBatchDto`):

- `events` — 1…25 объектов; `name` обязателен и соответствует `^[a-z][a-z0-9._-]{2,63}$`
  (например `page.view`, `feature.schedule`, `error.client`), `path` — с `/` и без query,
  `metadata` — произвольный объект, из которого вырезается всё чувствительное;
- `app` — одно из `portal`, `student`, `staff`, `admin`, `developer`, `android`, `max`;
- `installId` — UUID локальной установки (не идентификатор пользователя).

Источник (`source`) определяется заголовком `x-napare-client`, который принимает `web`,
`android`, `max`, `api`; при отсутствии заголовка источник выводится из User-Agent
(`NaPareAndroid/` → `android`, `MaxWebView|MaxApp/` → `max`, иначе `web`). Ограничение частоты:
120 запросов в минуту на IP. События с именем `error.*` получают категорию `error` и
`severity=error`, остальные — `ui`/`info`.

### 3.2 Витрина аналитики (Developer)

| Метод | Путь | Право | Описание |
| --- | --- | --- | --- |
| GET | `/platform/analytics/overview` | `analytics.read` | KPI, временной ряд, разбивки, воронка и retention |
| GET | `/platform/events` | `telemetry.read` | Журнал событий с фильтрами и offset-пагинацией |
| GET | `/platform/events/facets` | `telemetry.read` | Значения фильтров за период: категории, источники, имена, статусы |
| GET | `/platform/monitored-users` | `telemetry.read` | Пользователи с последней активностью, числом сессий и признаком блокировки |
| GET | `/platform/monitored-users/:id/activity` | `telemetry.read` | Карточка: профиль, метрики, сессии, входы, события, аудит |
| POST | `/platform/monitored-users/:id/revoke-sessions` | `accounts.write` | Отозвать все сессии пользователя (обязательна `reason`) |
| GET | `/platform/sessions` | `telemetry.read` | Журнал сессий: активные и завершённые |
| POST | `/platform/sessions/:id/revoke` | `accounts.write` | Отозвать конкретную сессию (обязательна `reason`) |

Списочные маршруты наследуют общий контракт пагинации (`page`, `limit` ≤ 100) и отвечают
`{ data, meta }`. Фильтры: `q`, `from`, `to` (ISO 8601), `universityId`, а также
`category`/`source`/`severity`/`name`/`userId` для журнала, `role`/`status` для пользователей,
`client`/`active` для сессий. `universityId` проходит проверку `assertUniversityScope`, поэтому
оператор не может выйти за свою область.

`overview` принимает `from`, `to`, `universityId` и `granularity` (`day` \| `week` \| `month`,
по умолчанию `day`) и возвращает:

- `range`, `generatedAt`, `collectionStartedAt` — период и момент, с которого телеметрия вообще собиралась;
- `totals.users` (`total`, `active`, `blocked`, `new`), `totals.sessions`, `totals.auth`
  (`logins`, `failedLogins`, `logouts`, `successRate`), `totals.events` (`total`, `errors`, `requests`, `avgDurationMs`), `totals.mobile` (`installs`, `appOpens`, `users`);
- `series[]` — ряд по `date_trunc(granularity)` (`registrations`, `logins`, `failedLogins`, `activeUsers`, `events`, `errors`);
- `breakdowns` — `clients`, `devices`, `os`, `browsers`, `roles`, `universities`, `features`, `paths`, `categories`;
- `funnel` — когорта регистраций → первый вход за 7 дней → действие в продукте за 7 дней, плюс `retention` для когорт старше 30 дней;
- `availability[]` и `limitations[]` — явный перечень того, что не измеряется и почему.

### 3.3 Сам-сервис сессий

| Метод | Путь | Кто | Описание |
| --- | --- | --- | --- |
| GET | `/auth/sessions` | Владелец аккаунта | Свои сессии: устройство, браузер, IP, время последнего действия, признак текущей |
| POST | `/auth/sessions/:id/revoke` | Владелец аккаунта | Отозвать свою сессию (нужна `reason`) |

Эти маршруты исключены из «университетского» guard'а (`SELF_SESSION_ROUTES` в
`apps/backend/src/common/guards/jwt-auth.guard.ts`), поэтому доступны аккаунту без вуза —
в том числе Developer.

## 4. Data model

Таблицы создаются миграцией `1700000000044-PlatformTelemetry`. Имена колонок в БД — camelCase
в кавычках (`"userId"`, `"lastSeenAt"`). Все три таблицы включают FK на `users(id)` и
`universities(id)`, индексы по времени и области, а также RLS-политики.

### 4.1 `user_sessions`

| Колонка | Назначение |
| --- | --- |
| `id` | UUID сессии; он же `sid` в JWT |
| `userId`, `universityId` | Владелец и контекст доступа (`FK`: `CASCADE` / `SET NULL`) |
| `client` | `web` \| `android` \| `max` \| `api` \| `backend` |
| `device`, `os`, `browser` | Разобранные значения (`parseUserAgent`), только для диагностики |
| `ip`, `userAgent` | Сетевой контекст и исходная UA-строка (до 64 и 512 символов) |
| `createdAt`, `lastSeenAt`, `expiresAt` | Жизненный цикл сессии; `expiresAt` = `createdAt` + TTL refresh-токена |
| `revokedAt`, `revokedBy`, `revokeReason` | Признак и причина завершения |
| `metadata` | jsonb, зарезервирован; заполняется только обезличенными значениями |

Статус сессии не хранится отдельной колонкой: сессия активна, если `revokedAt IS NULL`
и `expiresAt > now()`; индекс `IDX_user_sessions_active` построен именно по этому условию.

### 4.2 `auth_events`

`id`, `userId`, `universityId`, `type`, `emailHash`, `sessionId`, `client`, `ip`, `userAgent`,
`metadata`, `createdAt`.

`type` ∈ `login_success` \| `login_failed` \| `logout` \| `logout_all`. Причина отказа попадает
в `metadata.reason` как машинный код (`invalid_password`, `invalid_init_data`, `account_not_linked`,
`inactive`), а не как сообщение для пользователя. `emailHash` — HMAC-SHA256 от нормализованного
email с секретом JWT; он позволяет связать серии неудачных входов, не храня сам адрес.

### 4.3 `platform_events`

`id`, `source`, `category`, `name`, `severity`, `userId`, `universityId`, `sessionId`,
`method`, `path`, `statusCode`, `durationMs`, `ip`, `userAgent`, `metadata`, `createdAt`.

- `source` ∈ `backend` \| `web` \| `android` \| `max` \| `api`;
- `category` ∈ `auth` \| `request` \| `error` \| `ui` \| `admin` \| `system`;
- `severity` ∈ `debug` \| `info` \| `warning` \| `error` \| `critical`;
- `name` — стабильное имя (`http.request`, `http.error`, `page.view`, `admin.session_revoked`), до 120 символов;
- `path` — нормализованный путь без query (до 300 символов).

Отдельной колонки `payload` нет: произвольные атрибуты живут только в `metadata` и проходят санитизацию.

## 5. Access model & RLS

- Политики RLS определяются миграциями `1700000000029-TenantRowSecurity` (базовые политики для всех таблиц с `universityId`) и `1700000000044-PlatformTelemetry` (специальные предикаты для трёх таблиц телеметрии).
- Для `user_sessions`, `auth_events`, `platform_events`: SELECT разрешён, если `universityId` = контекст запроса (`napare_tenant_allows`) **или** `userId` = субъект запроса (`app.actor_id`). Второй предикат позволяет сам-сервису сессий работать на уровне БД.
- INSERT разрешён только по `napare_tenant_allows` (проверка universityId); UPDATE/DELETE — по объединённому предикату (tenant ИЛИ self).
- Триггер `napare_active_writer` на INSERT/UPDATE/DELETE гарантирует, что запись в телеметрические таблицы идёт только от имени сервиса (`napare_check_active_writer`), а не от JWT-актора.
- Роль приложения — `NOSUPERUSER NOBYPASSRLS`; `universityId` в INSERT проверяется через `WITH CHECK`.
- События без пользователя и без universityId (например, `login_failed` неизвестного email) не читаются через tenant-политику и не доступны через self-read (поскольку userId=null); они остаются в глобальной витрине Developer через сервисные запросы с `replaceActor`.
- Developer-аккаунт работает вне университетного контекста (`university_id = null`), поэтому витрина читает глобальные строки через сервисные запросы с `replaceActor` и явным `platform.require(...)`.

## 6. Business rules & validations

- **Идентификация сессии.** JWT содержит `sid`; `JwtStrategy` сверяет его с `user_sessions` и
  отклоняет токен, если сессия отозвана или истекла. Поэтому отзыв сессии немедленно прекращает доступ.
- **Продление активности.** `TelemetryInterceptor` вызывает `touchSession` не чаще, чем раз в 5 минут
  на сессию: SQL-запрос обновляет `lastSeenAt` только если прошло более 5 минут с прошлого тача.
- **Создание сессии.** `completeLogin` регистрирует сессию и пишет `login_success`;
  неудачный вход пишет `login_failed` без `userId`, если аккаунт не найден, и сохраняет
  `emailHash` — HMAC-SHA256 от нормализованного email с секретом JWT.
- **Изменение аккаунта.** Смена роли, университета или блокировка (`isActive`) меняет `sessionVersion`
  в таблице `users` и отзывает все сессии затронутого аккаунта, записывая `admin.sessions_revoked`
  в `platform_events` + запись в `platform_audit_logs`.
- **Sanitization.** `sanitizeMetadata` рекурсивно вырезает ключи, совпадающие с `pass(word)?|token|secret|authorization|cookie|credential|e-?mail|phone|jwt|api[-_]?key`, ограничивает глубину до 3, 30 ключей, 20 элементов массива и 300 символов на строку.
- **Нормализация путей.** `normalizePath` заменяет UUID на `:id`, числа длиной от 2 цифр на `/:n`,
  обрезает до 300 символов — поэтому в `paths` и `features` нет идентификаторов.
- **Retention.** `purgeExpired` запускается по `setInterval` каждые 60 минут и удаляет:
  `platform_events` старше 180 дней, `auth_events` старше 400 дней, `user_sessions` старше 400 дней
  (только те, что отозваны или истекли).
- **Совместимость с удалением аккаунта.** `account-erasure.service.ts` и `personal-data.catalog.ts`
  включают `user_sessions`, `auth_events`, `platform_events`, поэтому экспорт и удаление работают
  без доработок.
- **Честность метрик.** Витрина возвращает реальные агрегаты из БД; `availability` содержит
  `sessions` (true), `installs` (true, по `installId` из `metadata`), `downloads` (false),
  `ip_geography` (false), `retention` (true при наличии когорты старше 30 дней).

## 7. Telemetry sources

| Источник | Как попадает | Категории |
| --- | --- | --- |
| backend | `TelemetryInterceptor` (APP_INTERCEPTOR) | `request`, `auth`, `error` |
| web-* приложения | `TelemetryProvider` → `POST /telemetry/events` | `ui`, `error` |
| android-webview | `TelemetryBeacon` инжектит JS в страницу → `POST /telemetry/events` | `ui`, `error` |

Перехватчик не пишет события для `/health`, `/docs`, `/telemetry`, `/platform/analytics`,
`/platform/events`, `/platform/sessions`, `/events/stream` — иначе аналитика сама генерировала бы
поток событий и искажала метрики.

## 8. Events and integrations

- События административных действий пишутся в `platform_events` с категорией `admin`:
  `admin.session_revoked` (одна сессия) и `admin.sessions_revoked` (все сессии аккаунта),
  `severity=warning`; одновременно создаётся запись в `platform_audit_logs`.
- Блокировка и разблокировка аккаунта — это `PATCH /platform/accounts/:id` (`isActive`), который
  меняет `sessionVersion` и отзывает сессии; отдельного auth-события для этого нет, действия
  видны в аудите и в журнале сессий (`revokedBy`, `revokeReason`).
- Операционные уведомления (`ops-alerts`) остаются на канале домена `events`; телеметрия их не дублирует.
- Realtime-стрим `/events/stream` не затронут.

## 9. Non-functional requirements

- Запись телеметрии не должна прерывать бизнес-операцию: `enqueueEvent` кладёт событие в буфер,
  флаш выполняется каждые 2 секунды или когда в буфере набирается 50 событий, пачкой по 100 строк.
  При переполнении буфера (1000 событий) отбрасывается самое старое событие; ошибка флаша
  логируется и не всплывает в запросе.
- Клиентский beacon отправляется пакетами (`navigator.sendBeacon` при выгрузке), не блокирует UI,
  не ретраится агрессивно и не отправляет события без `installId`.
- Ограничение частоты на `POST /telemetry/events` — 120 запросов в минуту на IP; размер пакета — до 25 событий.
- Ошибка телеметрии никогда не делает бизнес-операцию неуспешной: `createSession`, `recordAuth`,
  `recordEvent` и `revokeAllForUser` логируют сбой и возвращают `null`/`false`/`0`.
- Агрегаты `overview` считаются одним набором SQL-запросов (`generate_series` для ряда), а не
  запросом на точку графика.
- В `metadata` и в server-логах не должно быть паролей, токенов, cookie и PII
  (см. `docs/security/secret-handling.md`).

## 10. Acceptance criteria

- [ ] Миграция `1700000000044-PlatformTelemetry` создаёт три таблицы с FK, индексами и RLS-политиками; `down` отказывается выполняться.
- [ ] Успешный вход создаёт `user_sessions` + `auth_events(login_success)`; JWT содержит `sid`.
- [ ] Неудачный вход создаёт `auth_events(login_failed)` с `emailHash` и без пароля в `metadata`.
- [ ] Отозванная сессия немедленно отклоняется на уровне `JwtStrategy` (401), а не только в UI.
- [ ] `GET /auth/sessions` доступен аккаунту без университета и показывает только его сессии.
- [ ] `POST /platform/sessions/:id/revoke` требует `accounts.write`, `reason`, пишет аудит и `admin.session_revoked`.
- [ ] `POST /platform/monitored-users/:id/revoke-sessions` требует `accounts.write` и пишет `admin.sessions_revoked`.
- [ ] `overview` возвращает только агрегаты из БД; `availability.downloads` и `availability.ip_geography` — `false` с причиной.
- [ ] `breakdowns.paths` не содержит UUID и числовых идентификаторов.
- [ ] `POST /telemetry/events` принимает анонимный пакет с `x-napare-client`, отвечает `202` и ограничивается 120/мин.
- [ ] HTTP-вызовы витрины Developer не создают событий телеметрии.
- [ ] `purgeExpired` соблюдает retention 180/400/400 дней.
- [ ] Экспорт и удаление аккаунта включают телеметрические таблицы (`personal-data.catalog.ts`).
- [ ] `pnpm --filter @napare/backend test`, `node scripts/security-route-inventory.cjs --check`, `pnpm typecheck` — зелёные.

## 11. Related docs

- [README](../README.md)
- [Архитектура ролей и прав](../architecture/roles-and-permissions.md)
- [Обзор схемы БД](../database/schema-overview.md)
- [Изоляция по tenant/RLS](../security/tenant-isolation.md)
- [Обработка секретов](../security/secret-handling.md)
- [Карта данных и retention](../privacy/data-map.md)
- [Модуль auth](auth.md)
- [Android WebView](../clients/android-webview.md)
- [Правила для контрибьюторов](../contributing.md)
