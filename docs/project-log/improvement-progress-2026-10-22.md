# Выполнение плана НаПаре от 22 октября 2026

Назначение: рабочий журнал реализации [исходного плана](improvement-plan-2026-10-22.md). Цель активна; непроверенные и согласуемые пункты не считаются завершёнными. Production не изменяется. Исходная база: `6f28912`.

## Состояние блоков

| Блок | Ветка | Состояние | Результат / условие завершения |
| --- | --- | --- | --- |
| P0-1, изоляция вузов | `codex/p0-tenant-isolation` | Реализовано; расширение маршрутного охвата | 325 routes; RLS, 11 SQL integration и 47 реальных HTTP сценариев. Это ещё не негативное выполнение каждого бизнес-маршрута |
| P0-2, роли и CI | `codex/p0-role-boundaries` | Проверено, draft PR | 11 ролей; 4009 guard HTTP probes; PostgreSQL suites обязательны в CI; [PR 1](https://github.com/DeminLab/NaPare/pull/1) |
| P0-3, восстановление | `codex/p0-backup-recovery` | Проверено локально, draft PR | Backup/restore scripts, readiness, алерты, runbook; [PR 2](https://github.com/DeminLab/NaPare/pull/2). Внешняя доставка/серверное расписание отдельно |
| P1-1, push и очередь | `codex/p1-notification-delivery` | Реализовано, draft PR, CI passed | [PR 7](https://github.com/DeminLab/NaPare/pull/7): outbox/Redis, провайдеры, retries/dead letter, default-off |
| P1-2, коннекторы | `codex/p1-schedule-connectors` | Реализовано, проверено локально | [Форматы и инструкция вузу](../integrations/schedule-import.md): ICS/CSV/XLSX/Moodle/SIBIT, PostgreSQL очередь и ScheduleChange журнал. 11 adapter tests, 7 HTTP/PG сценариев; внешние источники mocked |
| P1-3, новый вуз | `codex/p1-university-onboarding` | Реализовано, draft PR, CI passed | [PR 10](https://github.com/DeminLab/NaPare/pull/10): владелец создаёт вуз/структуру/администратора, администратор импортирует и проверяет свой вуз; без изменения navigation/header |
| P1-4, учебный офис | `codex/p1-academic-office` | Реализовано, draft PR, CI passed | [PR 6](https://github.com/DeminLab/NaPare/pull/6): заявления, назначения, решения, маршруты, диспетчер; PostgreSQL/HTTP/browser |
| P2-1, студент | `codex/p2-student-offline`, `codex/p2-semester-overview` | Offline и API семестра реализованы | [PR 5](https://github.com/DeminLab/NaPare/pull/5); [semester API](../integrations/moodle-semester.md), 8 real HTTP/PG сценариев. Экран `/student/semester` и ссылка из профиля реализованы после отдельного разрешения пользователя; browser с API fixtures прошёл. Экспорт/обезличивание и аудит доступности открыты |
| P2-2, работодатели | `codex/p2-career-billing` | Оплата реализована, draft PR | [PR 4](https://github.com/DeminLab/NaPare/pull/4): Т-Касса для услуг без выплат студентам; API/провайдер/UI проверены. ИНН/модерация/XLSX остаются открытыми |
| P2-3, персональные данные | `codex/p2-privacy-legal` | Документальная часть, draft PR, CI passed | [PR 9](https://github.com/DeminLab/NaPare/pull/9): карта данных, условная оценка, on-premise/RF deployment и проекты документов; утверждение/инфраструктура не подтверждены |
| P3, продажи и аналитика | — | В очереди | Закупочные черновики, реестр ПО, 10 метрик, сравнение монетизации |

## Проверки и ограничения

- После явного разрешения владельца исправлены A01–A05 из [WCAG-аудита](../ui/student-wcag-audit-2026-10-22.md): 36 светлых и 6 тёмных axe-снимков без violations, page errors и overflow; 16 server HTML titles и client/back/forward; keyboard и status трёх сохранений. Это scoped браузерная проверка с API fixtures, не полное подтверждение WCAG AA/NVDA.

- P2 accessibility: [студенческий WCAG-аудит](../ui/student-wcag-audit-2026-10-22.md) выявил contrast/title/feedback проблемы; axe/Chromium с синтетическим API и исходники. Отчёт не означает исправление, полный ручной прогон или подтверждение AA. Изменения защищённых UI-файлов не вносились.

- [Совместная интеграционная проверка PR 1–12](improvement-integration-2026-10-22.md): 41 unit suite/422 passed, 11 E2E suites/4513 passed/1 skipped; общий typecheck шести приложений, backend build, 6 offline VM тестов, lint/docs/guards и inventory355. Это локальные синтетические проверки, не production. Student semester UI опубликован в [PR 12](https://github.com/DeminLab/NaPare/pull/12); API семестра — в [PR 11](https://github.com/DeminLab/NaPare/pull/11).

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

Все три решения получены от владельца в этом чате: модель заявлений утверждена, выбрана Т-Касса для услуг без выплат студентам, student offline-кэш явно разрешён. Также получено отдельное разрешение на экран семестра и ссылку в профиле. Повторное согласование этих пунктов не требуется.

После объединения P0-1/P0-2: **37 unit suites / 377 tests passed**; **6 E2E suites / 4090 passed / 1 skipped** (native host agent не настроен). Последний полный прогон использовал обычное разрешение модулей после `pnpm install --offline --frozen-lockfile --ignore-scripts`, без временного Jest mapper. Все тестовые базы отдельные, runtime-роль без SUPERUSER/BYPASSRLS. Сбой двух копий TypeORM был локальным рассогласованием зависимостей; tracked manifests основного checkout не менялись.

Чужие незакоммиченные изменения основного checkout сохранены: страница команды и документ аудита от 21 октября. Блоки реализуются в отдельных worktrees, каждый со своей веткой и проверками.

## Уточнение состояния после согласований

- Учебный офис: утверждённая модель реализована в PR 6; 37 unit suites/377 passed, 7 E2E suites/4299 passed/1 skipped. Playwright проверил настоящий Next/Nest/PostgreSQL на синтетических аккаунтах. CI прошёл на `bc32bba`.
- Оплата: [утверждённая модель](../product/career-payments-model.md); код в PR 4. Локально 38 unit suites / 387 tests; 7 E2E suites / 4188 passed / 1 skipped. Все шесть CI jobs PR 4 прошли на `e8973b9`, включая сборку, аудит зависимостей и реальный PostgreSQL E2E. Банк в тестах synthetic/mock, настоящий терминал не вызывался.
- Offline: `bf465c5`, отдельная ветка. 6 focused tests, student typecheck, production build, root lint/docs lint/guards passed. Playwright с синтетическим backend проверил реальный worker на production build: новая offline-вкладка, расписание/задание, чужая identity, очистка, 320 px. Реальные аккаунты, мобильные устройства и production не проверялись. Подробные лимиты автозагрузки описаны в документации ветки.
- Dependency audit: закреплён `follow-redirects@1.16.1`; CI PR 3 прошёл на `0556899`. Остаточное moderate-предупреждение Nest SSE и существующая прикладная фильтрация описаны в [обзоре зависимостей](../security/dependency-review-2026-10-22.md). Major upgrade Nest не выполнялся.
- Коннекторы: завершены серверные адаптеры и транзакционная PostgreSQL очередь, обязательная FORCE RLS migration33, delta journal и инструкция вузу. Полный локальный прогон: 38 unit suites / 387 passed; 7 E2E suites / 4123 passed / 1 skipped (native host agent). Обычное разрешение модулей, независимая установка зависимостей; ни live Moodle/СИБИТ, ни production не проверялись. Push выполняется отдельно.
- CI коннекторов PR 8 прошёл на `8ad2109`; CI push PR 7 — на `07a4401`: все шесть jobs каждого PR успешны. Push: 38 unit suites/394 passed, полный E2E 7 suites/4100 passed/1 skipped и 10 focused PostgreSQL/Redis сценариев, внешние провайдеры mock/default-off.
- Onboarding: Playwright прошёл полный Next → Nest → PostgreSQL сценарий владельца и первого администратора: вуз/факультет/группа/аккаунт, queued CSV, настоящий worker, ручная привязка преподавателя, чтение сохранённой связи, 320/768/1440 px, keyboard, сетевой сбой/retry и запрет студента. Отдельный повтор использовал занятие в 00:30 UTC+06 с предыдущей UTC-датой. Админ typecheck, root lint/docs lint, AI/boundary guards и diff-check прошли. Admin build скомпилировал `/onboarding`; ограничения Windows standalone symlink отражены в инструкции. Все записи синтетические, production не менялся.
- Документы ПД опубликованы в PR 9 (`b0b0dbb`), CI успешен: карта, условная оценка, размещение, проекты поручения/политики/согласий. Утверждение юристом, фактические площадки, уничтожение данных и export остаются открытыми.
- Onboarding PR 10: все шесть CI jobs прошли на `d47f475`, включая Linux production build.
- Семестровый API: 39 unit suites/395 passed; полный E2E 8 suites/4196 passed/1 skipped native host agent. Реальные JWT/PostgreSQL/FORCE RLS migration36; Moodle mocked, транспорт отдельно покрыт HTTPS/DNS fixtures. Backend typecheck, root lint/docs lint, guards, inventory332 и diff-check прошли. Это не проверка live Moodle, student UI, исторического снимка оценок или официального реестра задолженностей.

## Невыполненные требования

Полное негативное выполнение каждого бизнес-маршрута; внешняя доставка backup и серверный restore drill; живые push-провайдеры и клиентские SDK/согласия; проверка внешних коннекторов и Moodle с настройками вуза; экспорт и обезличивание; WCAG-аудит; проверка компании по реестру, модерация и XLSX-отчёт; утверждение документов ПД и проверка фактической инфраструктуры; закупочные проекты, анализ реестра ПО, 10 метрик и сравнение монетизации. Локальные проверки предыдущих блоков не закрывают эти требования. Цель остаётся активной.
