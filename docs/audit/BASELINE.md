# Baseline-аудит репозитория NaPare (T-001, Приложение D ТЗ v1.1)

## Назначение

Датированный снимок фактического состояния репозитория, полученный без изменения кода. Документ фиксирует подтверждённые файлами факты, результаты команд, расхождения с документацией и ТЗ, риски и предложенный порядок работ. Это не утверждение готовности к production и не заменяет code review.

## Источник правды

- Код, TypeORM-миграции, CI-конфигурация и запущенные команды.
- Требования: `TZ-NaPare-v1.1-Production-Ready.md` (вне репозитория), Приложение D — протокол работы инженерных агентов.
- При конфликте: ADR > ТЗ > README и текущий код (согласно ТЗ, раздел «Приоритет документов»).

## Дата и условия проверки

| Поле | Значение |
| --- | --- |
| Дата | 2026-11-11 |
| Ветка / HEAD | `main`, `562aa4c` (2026-11-10, `feat(seo): полноценное SEO продвижение NaPare`) |
| Рабочее дерево | чистое (`git status --short` пуст до и после проверок) |
| Окружение | Windows 11, Node v24.11.1, pnpm 9.0.0, Docker-демон недоступен |
| Изменения в репо | ни одного; единственный временный шаг — `--write` инвентаря маршрутов для выявления расхождения с немедленным `git checkout --` откатом |

## Ограничения проверки

1. **E2E не выполнялись**: `docker ps` → ошибка подключения к `npipe:////./pipe/dockerDesktopLinuxEngine`. Требуемые PostgreSQL/Redis из `ci.yml` недоступны.
2. **Статус CI на GitHub не проверен**: API `repos/DeminLab/NaPare/actions/runs` → 404 (приватный репозиторий), `gh` не установлен. Все выводы о CI — воспроизводимые локально причины, а не наблюдение за ранами.
3. **Production-сборка не воспроизведена**: падает на Windows-специфике (см. ниже); корректность на целевом окружении не подтверждена.
4. Нагрузочные тесты, пентест и восстановление из резервной копии не проводились.

## Результаты команд

| Команда | Exit | Результат |
| --- | ---: | --- |
| `pnpm lint` | 0 | Без ошибок ESLint (`apps/**`, `packages/**`) |
| `pnpm typecheck` | 0 | 6 пакетов: backend, web-portal, web-student, web-staff, web-admin, web-developer |
| `pnpm test:unit` | 1 | 53 suites: 52 passed, **1 failed**; 526 тестов: **525 passed, 1 failed** |
| `pnpm build` | 1 | 6 задач: 1 успешная (backend), `web-portal` и `web-student` падают (EPERM/symlink) |
| `node scripts/security-route-inventory.cjs --check` | 1 | **Stale**: «Tenant route inventory is stale» |
| `node scripts/verify-role-workspace-boundaries.cjs` | 0 | `role workspace boundary guard: passed` |
| `pnpm security:audit` | 1 | **5 уязвимостей**: 1 high, 4 moderate |
| `pnpm test:e2e` | — | Не выполнялся: нет Docker-демона |

### Провал 1. Unit-тест: `config/configuration.spec.ts`

```
FAIL config/configuration.spec.ts
  ● environment configuration › starts with a valid JWT configuration
    Invalid environment configuration: DB_MIGRATION_USERNAME is required in production;
    DB_MIGRATION_PASSWORD is required in production
```

Причина воспроизводима и детерминирована:

- `apps/backend/src/config/configuration.spec.ts:8` выставляет `NODE_ENV: 'production'` и не задаёт `DB_MIGRATION_*`;
- `apps/backend/src/config/validate-environment.ts:29-33` требует `DB_MIGRATION_USERNAME`/`DB_MIGRATION_PASSWORD` при `production`;
- требование добавлено коммитом `b157812` / `9f1fbfa` «fix(backend): run production migrations as separate role»; spec с тех пор не менялся (последний коммит `3213907`);
- `.github/workflows/ci.yml:106-117` задаёт `NODE_ENV: test`, `JWT_*`, но **не** `DB_MIGRATION_*` → то же падение ожидаемо в CI-джобе `unit-tests`.

### Провал 2. Инвентарь маршрутов устарел

`docs/security/tenant-isolation.md` хранит снимок «386 объявлений маршрутов в 47 controller-файлах»; фактическая генерация даёт **382 маршрута в 46 controller-файлах**. Суть расхождения (после временного `--write` и сравнения):

- из инвентаря выпали удалённые QR-маршруты: `POST /api/v1/absences/attendance/qr-check-in`, `POST /api/v1/absences/attendance/qr-sessions`, `GET|PATCH /api/v1/platform-attendance-qr/sessions…` — файл `apps/backend/src/platform-attendance-qr/platform-attendance-qr.controller.ts` **отсутствует** в дереве;
- сместились ссылки на строки в `absences.service.ts` (например, `583` → `474`, `74` → `68`);
- удалены записи о `platform/jobs`.

Вывод: последний коммит, менявший маршруты (`9f1fbfa`/`562aa4c`-серия), не обновил инвентарь — CI-джоб `lint` падает на шаге `--check`.

### Провал 3. Аудит зависимостей

| Уровень | Пакет | Диапазон | Патч |
| --- | --- | --- | --- |
| high | `follow-redirects` | `>=1.16.0 <=1.16.1` | `>=1.16.2` |
| moderate | `@nestjs/core` | `<=11.1.17` (используется `10.4.22`) | `>=11.1.18` |
| moderate | `qs` | `>=6.7.0 <=6.16.0` (используется `6.16.0`) | `>=6.16.1` |
| moderate | ещё 2 (см. полный `pnpm audit --prod`) | — | — |

Важно: корневой `package.json:38-54` уже пинит `follow-redirects` через `pnpm.overrides` значением `1.16.1` — то есть пин **зафиксировал уязвимую версию**, тогда как патч — `1.16.2`. Джоба `security-audit` в `ci.yml` падает при `high > 0`.

### Провал 3b. Production-сборка (окружение)

`pnpm build` и `pnpm build:student` падают на шаге копирования traced-файлов standalone-бандла:

```
Error: EPERM: operation not permitted, symlink
'.../node_modules/.pnpm/react@18.3.1/node_modules/react'
-> '.../apps/web-student/.next/standalone/...'
```

`output: 'standalone'` объявлен во всех пяти `next.config.js` (`web-admin:11`, `web-student:10`, `web-developer:12`, `web-staff:11`, `web-portal:10`). Причина — отсутствие у процесса привилегии создания символических ссылок в Windows; это ограничение окружения, а не дефект кода. Сборка backend при этом успешна. Целевая сборка выполняется в CI на Linux — соответствие кода не подтверждено и не опровергнуто этой проверкой.

## Карта репозитория

### Состав workspace

| Область | Факт |
| --- | --- |
| Workspace | `apps/*`, `packages/*` (`pnpm-workspace.yaml`), Turborepo (`turbo.json`) |
| Активные приложения | `backend` (NestJS 10, TypeORM 0.3, PG16), `web-student`, `web-staff`, `web-admin`, `web-developer`, `web-portal` (Next.js 15.5.x, pin `next@15.5.28` через override) |
| Пакеты | `api-client`, `shared`, `ui`, `design-tokens` |
| Legacy, исключён из `dev`/`build`/`typecheck` | `apps/web`, `apps/max-miniapp` (`package.json:7,13,21`) |
| Прочее | `apps/android-webview` (Gradle, WebView-обёртка) |

### Backend

| Аспект | Факт |
| --- | --- |
| Модули | 38 `*.module.ts`, 48 `*.controller.ts`; зарегистрированы в `apps/backend/src/app.module.ts:62-190` |
| Заявленные в README | Auth, Schedule, PairSpace, Absences, MyDay, Notifications, Admin — все есть |
| Не отражены в README | `users`, `favorites`, `academic`, `semester`, `events`, `search`, `telemetry`, `career` (5 контроллеров), `career-billing`, `curation`, `requests`, `analytics`, `moodle`, `rasp`, слой `platform-*` (12 модулей + 4 контроллера `platform-academic`) |
| Сущности | 71 декоратор `@Entity`; реестр — `src/database/database.module.ts` (33 entities) |
| Миграции | 45 файлов, `apps/backend/src/migrations/1700000000000…1700000000045` (нет `…030`); последняя — `1700000000045-RemoveAttendanceQrSessions.ts` |
| Имена из ТЗ | `lesson_occurrence` — есть (`src/academic/entities/lesson-occurrence.entity.ts`); `schedule_change` — есть (`academic_schedule_changes`) + legacy `lesson_changes`; `request` — есть (`student_requests`, `request_steps`, `request_decisions`, `request_documents`) |
| Имена из ТЗ — отсутствуют | `person`, `user_role`, `student_profile`, `organization`, `lesson_template`, `request_type`, `grade`, `sheet`, `invite`, `guardian_link` |
| `organization_id` | 0 совпадений во всём репозитории; каноническое имя — `university_id`/`universityId` |
| Роли | `src/auth/interfaces/user-role.ts:1-13` — 11 ролей в enum, **одно поле** `users.role` (`src/users/entities/user.entity.ts:40-45`); таблицы ролей пользователя нет |
| Роли ТЗ | `registrar`, `parent`, `group_leader`, `dorm_manager`, `practice_supervisor` — 0 совпадений в репозитории |
| Роли вне ТЗ | `employer`, `career_staff`, `career_admin` (добавлены `1700000000017-CareerPlatform.ts:5-7`) |
| Вход | `POST /auth/login` (email+password), `POST /auth/max` (initData, проверка `src/auth/max-init-data.ts:93` HMAC + `timingSafeEqual`), `POST /auth/portal-login`, `POST /auth/refresh`, `POST /auth/logout`; `POST /auth/register` → всегда 403 (`auth.controller.ts:142`); Telegram-link → 410 |
| Вход без MAX | только email+password; SMS/код/OTP/passkey/WebAuthn — 0 совпадений |
| Tenant | `src/common/tenant/tenant-context.ts` (AsyncLocalStorage, `assertAccess`), `require-university.ts`, `tenant-database.ts` (`set_config('app.university_id', …)`, роль `NOSUPERUSER NOBYPASSRLS`) |
| UniversityGuard | `src/common/guards/university.guard.ts` существует, но **ни один controller его не подключает** (см. `docs/security/tenant-isolation.md:26`) |
| RLS | включён миграциями: `1700000000029-TenantRowSecurity.ts` (`ENABLE/FORCE ROW LEVEL SECURITY`, политики `napare_tenant_*`, функция `napare_tenant_allows`), плюс политики в `…037`, `…038`, `…040`–`…042`, `…044` |
| Redis / очереди | код есть: `ioredis` + `bullmq` в `src/notifications/delivery/notification-delivery.service.ts`; включение — флагами `delivery-config.ts:3-11` (`NOTIFICATIONS_DELIVERY_ENABLED`, `NOTIFICATIONS_QUEUE_ENABLED`), **которых нет в `apps/backend/.env.example`** → по умолчанию выключено |
| Push | реализован: `src/notifications/delivery/push-providers.ts` (каналы `webpush\|rustore\|telegram\|max`, VAPID в `webpush-policy.ts`); тот же флаговый старт |
| S3/MinIO | не подключено: 0 совпадений `@aws-sdk\|aws-sdk\|minio\|s3Client`; в `.env.example:42-46` только заготовки `STORAGE_*`; MinIO есть только в `docker-compose.dev.yml` |
| Планировщик | отдельных BullMQ-джоб для PDF/импортов нет; импорт расписания — DB-очередь с `skipLocked` (`src/schedule/connectors/schedule-import.service.ts:130`) |
| OpenAPI | генерируется из кода в `src/main.ts:86-96`, доступен **только вне production** (`if (!isProduction)`); зафиксированного `openapi.json` в репо нет |
| `@napare/api-client` | написан руками (`src/client.ts:29`), генерации нет; **не импортируется ни одним приложением** (0 совпадений) |
| Формат ошибок | `statusCode, code, message, details, timestamp, path` (`src/common/filters/http-exception.filter.ts:19`, `main.ts:88`) — без `request_id` |
| Rate limit | глобальный `ThrottlerGuard` (`app.module.ts:150,192`) |
| SSE | `src/events/events.controller.ts` — есть (соответствует API-RT-01) |
| Ingest API, вебхуки наружу, `napare-agent`, `/public/v1`, фиче-флаги | отсутствуют (0 совпадений `ingest`, внешних webhook, `public/v1`, `featureFlag/FEATURE_`) |
| Поиск | `ILIKE`-запросы; `to_tsvector` не используется; расширение `pg_trgm` создаётся в `src/database/init.sql:7`, но в запросах не применяется |
| PDF / QR-документы | генерация PDF, `qrcode`, страница `/v/{code}` — отсутствуют (0 совпадений по `puppeteer\|pdfkit\|docx\|qrcode\|verifyCode`) |

### Клиенты

| Аспект | Факт |
| --- | --- |
| Нижняя навигация студента | `apps/web-student/src/components/navigation/StudentShell.tsx:44` → `['/today','/week','/pair-space','/notifications']` + кнопка «Ещё»; общий каркас `packages/ui/src/WorkspaceShell.tsx:55,179` |
| Вкладки ТЗ (Сегодня/Расписание/Сервисы/Профиль) | не реализованы: фактически «Сегодня / Неделя / К паре / Уведомления»; «Профиль» — в боковом меню; раздела «Сервисы» в `web-student` нет |
| PWA | manifest — `src/app/(student)/manifest.webmanifest/route.ts`, SW — `src/app/(student)/sw.js/route.ts` (вручную, без workbox), регистрация — `PwaRegistration.tsx:38` |
| Offline-кэш расписания | `src/app/(student)/offline-schedule.ts` — `OFFLINE_MAX_AGE = 7 дней` (ТЗ NFR-07 требует 14 дней) |
| Web Push на клиенте | только в `web-portal` (`notifications/setup/WebPushSetup.tsx:31-94`); в `web-student` push-подписки нет (0 совпадений `pushManager\|applicationServerKey`) |
| Экран «Заявки» (учебный офис) | есть: `web-admin/src/app/(admin)/requests/` (`CreateRequest`, `RequestCard`, `DispatcherWorkspace`, `OfficeSettings`, `reports/`) |
| «Справки», «Журнал преподавателя», «Ведомости», «Зачётка», «Родитель», «Хаб сервисов» | в клиентах не найдены |
| Импорт | `web-admin/src/app/(admin)/schedule-import/page.tsx` — 5 шагов, форматы **CSV/JSON**; `onboarding/ImportStep.tsx` — `csv, json, ics, xlsx, moodle, sibit` → `POST /admin/schedule/upload` |
| Серверный dry-run / откат импорта | отсутствуют: `dryRun` встречается только в CLI `src/cli/provision-sibit-teachers.ts:53`; компенсирующего отката в БД нет |
| Дизайн-токены | `packages/design-tokens/styles.css:7,22-24` — бренд `#4f46e5` (indigo); цвет `#1459D0` из ТЗ не встречается |
| Тёмная тема | есть: `globals.css:136+` (`data-student-palette="dark"`), `StudentAppearanceProvider.tsx:23-28`, `design-tokens/styles.css:64-76` |

### Процесс, инфраструктура, документация

| Аспект | Факт |
| --- | --- |
| CI | `.github/workflows/ci.yml` — джобы `lint` (lint + route-inventory `--check` + role-workspace-boundaries), `typecheck`, `unit-tests` (coverage + offline-тест SW), `e2e` (postgres16 + redis7, ~17 disposable БД, role-policy/tenant-rls), `build`, `security-audit` |
| Staging | `.github/workflows/staging.yml` — сборка GHCR-образов, деплой через GitHub Environment, smoke `/api/v1/health` |
| Production | ручной (`docs/deployment/production.md`); в CI явно «no production deployment workflow» |
| Compose | `prod` (nginx, backend, 5 web, postgres, redis; hardening `read_only`, `no-new-privileges`, `cap_drop: ALL`, сети `egress/edge/app/data`), `dev` (postgres, redis, minio), `migrate`, `control` |
| Kubernetes | отсутствует |
| SSL | `infrastructure/nginx/ssl/*.pem` в рабочем дереве, не отслеживается git (`.gitignore:74`) |
| ADR | 7 штук, все «Принято» (`docs/decisions/0001…0007`): монолит, мультивузовость через `university_id`, JWT, OpenAPI, стек, монорепо, деплой. **Нет ADR по RLS/tenant-изоляции, расписанию, заявкам, мультиролям** — ровно те, что требует G0/T-002…T-006 |
| `docs/security/` | `tenant-isolation.md` (инвентарь 386/47), `role-matrix.md` (11 ролей, матрица маршрут×роль, baseline `apps/backend/test/fixtures/role-policy.json`), `threat-model.md`, `152-fz.md`, отчёты проб |
| Внутренний конфликт доков | `threat-model.md` и `docs/database/schema-overview.md:~` утверждают, что RLS не включён; `tenant-isolation.md` и код миграций — что включён |
| `docs/legal/` | 8 черновиков с незаполненными полями оператора («Не публиковать», «Черновик для юриста») |
| `docs/privacy/` | 6 документов: экспорт, удаление, карта данных, архивная модель, внешние копии |
| `docs/audit/` | **отсутствовал** — создан этим документом |
| `docs/metrics/` | отсутствует (ТЗ требует для KPI-01…KPI-10) |
| `.env` | существует, **не попадает в git** (`.gitignore:30`, `git check-ignore` → `.gitignore:30:.env*`); в индексе только `.env.example` |
| Git | рабочее дерево чистое; `main` + 41 локальная ветка `codex/*` с зеркалом на `origin` |

## Расхождения документация ↔ код

| # | Где утверждается | Факт |
| --- | --- | --- |
| D-1 | `README.md:120`, `README.md:589`, `docs/database/schema-overview.md`, `docs/security/threat-model.md`: «RLS policies не настроены» | RLS включён и форсирован: `1700000000029-TenantRowSecurity.ts:77-92`, обёртка `common/tenant/tenant-database.ts`, e2e `test/tenant-rls.e2e-spec.ts` |
| D-2 | `README.md:115,194,295,335`: «Redis client/queues не подключены», «Push не реализован» | `bullmq`/`ioredis`/`web-push` подключены в коде, но стартуют только по флагам, отсутствующим в `apps/backend/.env.example` |
| D-3 | ADR-0004 «OpenAPI source of truth»; `docs/api/README.md:91-93` про генерацию клиента | Спека в репо не хранится; `@napare/api-client` рукописный и не используется приложениями |
| D-4 | `docs/security/tenant-isolation.md` — «386 маршрутов в 47 controllers» | 382/46; проверка `--check` падает |
| D-5 | README «Модули системы» (7 модулей) | ~25 модулей с API, включая `career-*`, `requests`, `platform-*` |
| D-6 | README «Роли» / `packages/shared/src/constants/roles.ts` (8 ролей) | enum backend — 11 ролей; расхождение между shared-константой и backend-enum |

**Дополнение 2026-11-11:** после снимка D-1, D-2, D-5 и D-6 исправлены в README и справочных документах. D-3 (спека OpenAPI не хранится в репозитории) и расхождение `packages/shared` с backend-enum остаются; D-4 закрыт перегенерацией `tenant-isolation.md` (382/46). Снимок ниже по тексту не переписывался.

## Расхождения с ТЗ 1.1

Полная матрица — в [TZ-1.1-GAP-ANALYSIS.md](./TZ-1.1-GAP-ANALYSIS.md). Краткая сводка блокеров:

| Область ТЗ | Статус |
| --- | --- |
| §4 Модель `organization` / `person` / профили | ❌ канон `university_id`, `users.universityId` |
| §4 Мультироли (`user_role`) | ❌ одна роль в `users.role` (R-6 подтверждён) |
| §4 Роли `registrar`, `parent`, `group_leader`, `dorm_manager`, `practice_supervisor` | ❌ отсутствуют |
| FR-NAV-01 четыре вкладки | ❌ фактический набор иной |
| FR-ONB-01…04 приглашения и привязка профиля | ❌ `invite`/`link_request` отсутствуют |
| FR-ONB-03/06 второй фактор и вход без MAX | ❌ только email+password |
| FR-REQ-01/06 движок заявок и workflow | ⚠️ 3 жёстких типа, свои статусы, без SLA/шаблонов PDF |
| FR-IMP-04/05/07/08 dry-run, отчёт, откат | ❌ только клиентский предпросмотр |
| FR-SCH-02 расчёт типа недели (§11.3) | ❌ нет `academic_term`/`week1_anchor`/`cycle_length` |
| FR-SCH-12 iCal-подписка | ❌ есть только импорт iCal |
| FR-JRN / FR-GRD / FR-RTG журнал, ведомости, зачётка | ❌ отсутствуют |
| FR-PAR родители | ❌ отсутствуют |
| FR-SRV хаб сервисов | ❌ отсутствует на клиенте |
| INT-01/FR-ING Ingest API, агент, вебхуки | ❌ отсутствуют |
| ARC-04 S3, ARC-13 фиче-флаги, ARC-10 sandbox | ❌ отсутствуют |
| SEC-02 RLS | ✅ реализовано (противоречит README/threat-model) |

## Риски

| ID | Риск | Влияние | Митигация (предлагаемая) |
| --- | --- | --- | --- |
| BR-1 | CI на `main` падает: unit-тест, route-inventory, security-audit | Нет зелёного гейта для любых PR; релизные gates G0/G4 недостижимы | Вернуть зелёный CI первым шагом (задача 1 ниже) |
| BR-2 | Документация противоречит коду по RLS и Redis/Push | Ошибочные решения при аудите и планировании; риск «исправить» уже работающую защиту | Синхронизировать README/`schema-overview`/`threat-model` с `tenant-isolation.md` |
| BR-3 | Инвентарь tenant-маршрутов устарел | Потеря видимости новых необработанных маршрутов | `--write` в CI как шаг, предваряющий `--check`, либо авто-генерация в том же PR |
| BR-4 | `pnpm.overrides` пинит уязвимую версию (`follow-redirects@1.16.1`) | High-уязвимость закреплена централизованно | Обновить override до `1.16.2`, перепроверить `pnpm audit` |
| BR-5 | S3 не подключён при заявленных документах о файлах | Вложения и будущие PDF не имеют утверждённого хранилища (ARC-04, SEC-05) | ADR по хранилищу до M2 |
| BR-6 | Push/Redis выключены из-за отсутствия флагов в `.env.example` | Тихая деградация: фичи написаны, но «выключены» без видимого следа | Добавить флаги в `.env.example` с комментарием и задокументировать в `docs/modules/notifications.md` |
| BR-7 | `docs/legal/` — черновики | Блокирует загрузку реальных ПДн (G5) | Не заполнять агентом; передать оператору/юристу |
| BR-8 | Проверки на Windows неполны (build, e2e) | Ложное впечатление о неработоспособности или, наоборот, о готовности | Повторить build/e2e на Linux-стенде или в CI |

## Предлагаемый порядок работ

Ниже — максимум пять следующих вертикальных задач с зависимостями, критериями приёмки и тестами (Приложение D, D.5). Это **предложение для согласования Tech Lead**, а не принятый план.

### 1. Восстановить зелёный CI (блокирует всё остальное)

Зависимости: нет.
Объём: обновить `docs/security/tenant-isolation.md` через `--write`; поправить `configuration.spec.ts` (задать `DB_MIGRATION_*` в тестовом окружении либо смягчить правило для `NODE_ENV=test`); поднять `pnpm.overrides.follow-redirects` до `1.16.2` и разобрать оставшиеся moderate.
Критерий приёмки: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `security-route-inventory --check`, `verify-role-workspace-boundaries`, `pnpm security:audit` — exit 0; джобы CI зелёные.
Тесты: существующий `configuration.spec.ts`; новый тест на валидацию production-конфигурации с `DB_MIGRATION_*`; регресс — `--check` в CI.

### 2. ADR + миграция tenant-идентичности (`university_id` → `organization_id`)

Зависимости: задача 1.
Объём: ADR по RLS/tenant (T-005) и по мультиролям (T-004); expand→migrate→contract-миграция канонического имени (`TZ §11.1`), период совместимости, обновление `tenant-database.ts` и политик.
Критерий приёмки: все существующие e2e (`tenant-isolation`, `tenant-rls`, `role-policy`, `requests`) зелёные; миграция обратима на один релиз; `organization_id` — единственное смысловое имя в API.
Тесты: существующий набор tenant-e2e + отдельный тест на отсутствие второго смыслового идентификатора.

### 3. Мультироли `user_role` с периодом совместимости

Зависимости: задача 2.
Объём: таблица `user_role (user_id, organization_id, role, scope jsonb)`, миграция с `users.role`, dual-read/dual-write, удаление legacy после подтверждения (R-6/T-004); новые роли `registrar` и `parent` — как отдельный следующий слой, не в одной поставке.
Критерий приёмки: пользователь может иметь роли в двух организациях; `role-policy`-бейзлайн обновлён осознанно (diff в PR); откат миграции не теряет данные.
Тесты: `role-policy.e2e-spec.ts`, новый кейс «две роли у одного `user` в разных организациях».

### 4. Расписание-шаблоны: `academic_term` + расчёт недели + унификация `lessons`

Зависимости: задача 2.
Объём: `academic_term` (starts_on, cycle_length, week1_anchor, week1_type), `calendar_exception`, расчёт по формуле §11.3, контрольный набор дат 11.3 как unit-тест, приведение `lesson_series`/`lesson_occurrences`/`lessons` к модели ТЗ (T-003, T-015, T-016).
Критерий приёмки: пять контрольных дат из §11.3 проходят; выдача расписания «до/после» эквивалентна (сравнительный тест); `GET /schedule/week-type` отдаёт номер и тип недели.
Тесты: unit по таблице 11.3, интеграционный — сравнение выдачи до/после миграции.

### 5. Онбординг по приглашениям (первый вертикальный пользовательский срез)

Зависимости: задачи 2 и 3.
Объём: сущности `invite` (token_hash, expires_at, attempts) и `link_request`, непривязанный профиль, `POST /invites/{token}/claim` с rate limit и одинаковым ответом на «нет такого»/«неверный фактор» (SEC-09), заявка на привязку в очередь сотрудника.
Критерий приёмки: студент подключается по ссылке и видит своё расписание; перебор токенов блокируется и журналируется; QA-01 (cross-tenant) остаётся зелёным.
Тесты: integration на лимит попыток и хэширование токена, e2e на полный сценарий привязки, security на отсутствие перечисления профилей.

## Проверка

```powershell
pnpm lint                                   # exit 0
pnpm typecheck                              # exit 0
pnpm test:unit                              # exit 1 (configuration.spec.ts)
pnpm build                                  # exit 1 (EPERM/symlink, окружение)
node scripts/security-route-inventory.cjs --check   # exit 1 (stale)
node scripts/verify-role-workspace-boundaries.cjs   # exit 0
pnpm security:audit                         # exit 1 (5 уязвимостей)
docker ps                                   # демон недоступен → e2e не запускались
git status --short                          # пусто
```

## Изменения и открытые вопросы

- 2026-11-11: baseline-аудит по Приложению D ТЗ v1.1; проверка: команды выше — выполнены, код не изменялся. Блокер: e2e и production-сборка не воспроизводятся в этом окружении.
- 2026-11-11: **задача 1 (восстановление зелёного CI) выполнена**. Провалы 1–3 устранены: в `configuration.spec.ts` заданы `DB_MIGRATION_*` для production-окружения теста (526/526); инвентарь маршрутов регенерирован `--write` (382/46, `--check` exit 0); в `pnpm.overrides` подняты `follow-redirects` 1.16.1→1.16.3 и `qs` 6.16.0→6.16.2 (`pnpm security:audit` exit 0). Остаются 3 moderate без патчей в пределах текущих major: `@nestjs/core` (требует Nest 11.1.18), `glob` (≥14.0.2), `minimatch` (≥11.0.1) — отдельная задача апгрейда. Не проверено в этом окружении: e2e (нет Docker), сборка на Linux, статус CI на GitHub.
- 2026-11-12: **задача 2 (ADR + миграция tenant-идентичности `university_id` → `organization_id`) выполнена**. Приняты ADR-0008 (tenant RLS: канон `organizationId`/`organization_id`, legacy-колонка остаётся в БД как синхронизируемый триггером алиас, contract-шаг откладывается до подтверждения периода совместимости по §15.1) и ADR-0009 (мультироли — план задачи 3); в ADR-0002 добавлена сноска о статусе канона. Expand-миграция `1700000000046-TenantOrganizationAlias`: добавление alias-колонок + триггеры синхронизации camel/snake, адресная замена индексов/FK/функций/политик, backfill с временным отключением RLS и erasure-guard-триггера `napare_active_writer` (иначе backfill-UPDATE падает на непустой БД: lookup получателя идёт под FORCE RLS без tenant GUC — воспроизведено и исправлено), явный сброс legacy-колонки в NULL-ветке триггера. В `tenant-database.ts` добавлен helper `dropLegacyColumnDependencies`, в `app.module.ts` — dev-ветка «46 → хвост миграций → 46». Переименовано 242 файла; спеки, вызывающие миграции 31/32/33/34/36, обёрнуты в `46.up()`. Результаты: `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm lint:docs` exit 0 (772 файла); `pnpm test:unit` 526/526; `security-route-inventory --check` exit 0 (382 маршрута); полный e2e: **20/20 suites, 4980 passed / 0 failed / 1 skipped**, exit 0 (619 с; `tenant-isolation` 190.7 с, `requests` 43.7 с). Не выполнялось: `pnpm build` (Windows EPERM/symlink), CI на GitHub (приватный репо).
- Открытые вопросы для Tech Lead: фактический статус CI на GitHub; согласование очерёдности из пяти задач; решение по каноническому имени tenant (ADR-0002 против ТЗ §11.1) — закрыто ADR-0008.
