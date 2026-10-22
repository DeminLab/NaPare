# Выполнение плана НаПаре от 22 октября 2026

Назначение: рабочий журнал реализации [исходного плана](improvement-plan-2026-10-22.md). Цель активна; непроверенные и согласуемые пункты не считаются завершёнными. Production не изменяется. Исходная база: `6f28912`.

## Состояние блоков

| Блок | Ветка | Состояние | Результат / условие завершения |
| --- | --- | --- | --- |
| P0-1, изоляция вузов | `codex/p0-tenant-isolation` | Реализовано; расширение маршрутного охвата | 325 routes; RLS, 11 SQL integration и 47 реальных HTTP сценариев. Это ещё не негативное выполнение каждого бизнес-маршрута |
| P0-2, роли и CI | `codex/p0-role-boundaries` | Проверено, draft PR | 11 ролей; 4009 guard HTTP probes; PostgreSQL suites обязательны в CI; [PR 1](https://github.com/DeminLab/NaPare/pull/1) |
| P0-3, восстановление | `codex/p0-backup-recovery` | Проверено локально, draft PR | Backup/restore scripts, readiness, алерты, runbook; [PR 2](https://github.com/DeminLab/NaPare/pull/2). Внешняя доставка/серверное расписание отдельно |
| P1-1, push и очередь | `codex/p1-notification-delivery` | Реализовано, draft PR | [PR 7](https://github.com/DeminLab/NaPare/pull/7): Redis delivery/outbox, провайдеры, retries/dead letter; внешние отправки выключены |
| P1-2, коннекторы | `codex/p1-schedule-connectors` | Реализовано, draft PR | [PR 8](https://github.com/DeminLab/NaPare/pull/8): ICS/CSV/XLSX/Moodle/SIBIT, очередь, журнал, форматы; новый UI в следующем onboarding |
| P1-3, новый вуз | — | После коннекторов | Мастер и проверка готовности, без изменения navigation/header |
| P1-4, учебный офис | `codex/p1-academic-office` | Реализован, draft PR, CI passed | [PR 6](https://github.com/DeminLab/NaPare/pull/6): заявления, назначения, поэтапные решения, маршруты, журнал и рабочее место диспетчера; локальные HTTP/PG и browser проверки |
| P2-1, студент | `codex/p2-student-offline` | Offline реализован, остальные задачи открыты | Разрешение получено; worker и cold offline navigation проверены. Семестр, экспорт/обезличивание и аудит доступности ещё не выполнены |
| P2-2, работодатели | `codex/p2-career-billing` | Оплата реализована, draft PR | [PR 4](https://github.com/DeminLab/NaPare/pull/4): Т-Касса для услуг без выплат студентам; API/провайдер/UI проверены. ИНН/модерация/XLSX остаются открытыми |
| P2-3, персональные данные | `codex/p2-privacy-legal` | Документальная часть подготовлена | Карта моделей/хранилищ/оснований/сроков, условные сценарии уровня, размещение, проекты поручения/политики/согласий. Юридическое утверждение и реальная инфраструктура не подтверждены |
| P3, продажи и аналитика | — | В очереди | Закупочные черновики, реестр ПО, 10 метрик, сравнение монетизации |

## Проверки и ограничения

- Docker Desktop Linux engine недоступен. Это не препятствие для отдельного локального PostgreSQL 18: тестовый кластер создан на `127.0.0.1:55439`, отдельно от установленного сервера.
- Начальный backend unit baseline: 35 suites, 33 passed, 2 failed; 352 tests, 341 passed, 11 failed. Существующие проблемы: невалидные UUID в PairSpace test fixtures и Moodle BlockList/DNS fixture. Исправления и повторный запуск относятся к P0-2.
- P0-1 focused unit: 5 suites, 62 tests passed после guard/reference правок. Это результат конкретного запуска, не итог всего блока.
- P0-2 HTTP guard probe: 4009 tests passed на реальных JWT strategy/guards с синтетическим ответом конечного handler. Это не выполнение 325 бизнес-обработчиков с production данными.
- RLS core: отдельный non-superuser owner PostgreSQL runtime fixture проверяет FORCE RLS, read/write, transaction manager, pool concurrency, auth identity и ограниченные grants. Полный объединённый E2E-прогон прошёл; негативное выполнение всех бизнес-маршрутов ещё не покрыто.
- Ежедневное расписание backup, внешний storage, реальная доставка push, договор эквайринга, реестр ПО, юридическая оценка и production deployment требуют отдельных операционных действий. Локальный код и инструкции не доказывают их выполнение.

## Согласования, предусмотренные исходным планом

1. Утвердить модель заявлений учебного офиса до реализации backend/UI.
2. Выбрать провайдера и финансовый сценарий оплаты до кода эквайринга.
3. Явно разрешить student service worker/offline изменения в защищённом каталоге.

Все три решения получены от владельца в этом чате: модель заявлений утверждена, выбрана Т-Касса для услуг без выплат студентам, student offline-кэш явно разрешён. Повторное согласование этих пунктов не требуется.

После объединения P0-1/P0-2: **37 unit suites / 377 tests passed**; **6 E2E suites / 4090 passed / 1 skipped** (native host agent не настроен). Последний полный прогон использовал обычное разрешение модулей после `pnpm install --offline --frozen-lockfile --ignore-scripts`, без временного Jest mapper. Все тестовые базы отдельные, runtime-роль без SUPERUSER/BYPASSRLS. Сбой двух копий TypeORM был локальным рассогласованием зависимостей; tracked manifests основного checkout не менялись.

Чужие незакоммиченные изменения основного checkout сохранены: страница команды и документ аудита от 21 октября. Блоки реализуются в отдельных worktrees, каждый со своей веткой и проверками.

## Уточнение состояния после согласований

- Учебный офис: [утверждённая модель](../product/academic-office-requests-model.md) реализована в [PR 6](https://github.com/DeminLab/NaPare/pull/6). Настоящие PostgreSQL/JWT/HTTP проверяют миграции и RLS, назначения, приватность, решения, идемпотентность и диспетчерские правки. Playwright проверил Next → Nest → PostgreSQL на синтетических записях: принятие/согласование, создание оператором, настройки маршрута, фильтр/пустое состояние, сетевой сбой/retry, CSV, время/аудитория диспетчера, клавиатура и ширины 320/768/1440. Production и официальные юридические решения не проверялись.
- Повторный E2E-прогон ветки учебного офиса: 7 suites / 4299 passed / 1 skipped (native host agent), включая 14 собственных HTTP/PG сценариев. Backend/admin typecheck, lint/docs lint, документационный и boundary guards, актуальность route inventory (340 routes) прошли. Unit-прогон этой реализации: 37 suites / 377 passed. Локальная сборка admin завершилась с предупреждением Windows standalone symlink, указанным в инструкции модуля.
- Оплата: [утверждённая модель](../product/career-payments-model.md); код в PR 4. Локально 38 unit suites / 387 tests; 7 E2E suites / 4188 passed / 1 skipped. Все шесть CI jobs PR 4 прошли на `e8973b9`, включая сборку, аудит зависимостей и реальный PostgreSQL E2E. Банк в тестах synthetic/mock, настоящий терминал не вызывался.
- Offline: `bf465c5`, отдельная ветка. 6 focused tests, student typecheck, production build, root lint/docs lint/guards passed. Playwright с синтетическим backend проверил реальный worker на production build: новая offline-вкладка, расписание/задание, чужая identity, очистка, 320 px. Реальные аккаунты, мобильные устройства и production не проверялись. Подробные лимиты автозагрузки описаны в документации ветки.
- Dependency audit: закреплён `follow-redirects@1.16.1`; CI PR 3 прошёл на `0556899`. Остаточное moderate-предупреждение Nest SSE и существующая прикладная фильтрация описаны в [обзоре зависимостей](../security/dependency-review-2026-10-22.md). Major upgrade Nest не выполнялся.
- Коннекторы опубликованы в PR 8 (`8ad2109`): 38 unit suites/387 passed, полный PostgreSQL E2E 7 suites/4123 passed/1 nativehost skip. Push опубликован в PR 7 (`07a4401`, код `03d242e`): 38 unit suites/394 passed, полный E2E 7 suites/4100 passed/1 nativehost skip и 10 focused PostgreSQL/Redis E2E. Внешние источники и провайдеры заменены mock; реальные отправки не выполнялись. CI этих PR проверяется отдельно.
- CI PR 6 прошёл на `bc32bba`; проверка Linux build не имеет локального ограничения Windows symlink. Документы ПД в этой ветке описывают собственную базу `9965e9a`, а новые PR — отдельно; это не объединённый релиз всех функций.
- P2-3: [оценка](../legal/personal-data-assessment.md), [карта](../privacy/data-map.md), [размещение](../legal/rf-deployment-assessment.md), [поручение](../legal/data-processing-agreement-draft.md), [согласия](../legal/consent-drafts.md). Редакция доступной официальной копии закона ограничена 2025 годом; юристу явно оставлена проверка действующей редакции и утверждение уровня/оснований. Уведомления и заявления от имени оператора не отправлялись.

## Невыполненные требования

Полное негативное выполнение каждого бизнес-маршрута; внешняя доставка backup и серверный restore drill; живые push-провайдеры и клиентские SDK/согласия; onboarding UI и итоговый CI новых PR; семестровый обзор; экспорт и обезличивание; WCAG-аудит; проверка компании по реестру, модерация и XLSX-отчёт; правовое утверждение и проверка реального RF/on-premise размещения; закупочные проекты, анализ реестра ПО, 10 метрик и сравнение монетизации. Локальные проверки предыдущих блоков не закрывают эти требования. Цель остаётся активной.
