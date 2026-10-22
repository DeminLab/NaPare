# Совместная проверка улучшений — 22 октября 2026

Документ для ревьюера интеграционной ветки `codex/improvement-integration`. Ветка объединяет изменения draft PR 1–12 на базе `6f28912`; это кандидат для совместного ревью, не deployment и не утверждение полного выполнения [плана](improvement-plan-2026-10-22.md).

## Что объединено

Роли/CI, изоляция вузов и FORCE RLS, восстановление, очередь уведомлений, коннекторы расписания, подключение вуза, учебный офис, оплата услуг Т-Кассой без выплат студентам, student offline-кэш, документы ПД, semester API и разрешённый экран семестра. Содержимое страницы вуза сохраняет обе ссылки — на onboarding и заявления. Общий AppModule включает все feature-модули; зависимости очереди и импорта объединены. Lockfile разрешён самим pnpm и проверен frozen install в отдельном физическом node_modules.

## Локальные доказательства

| Проверка | Результат и предел доказательства |
| --- | --- |
| Backend unit | 41 suite, 422 tests passed |
| Полный E2E | 11 suites, 4513 tests passed, 1 skipped native host agent. Настоящие Nest/JWT/PostgreSQL/Redis; уникальные синтетические БД/роли/очереди. Внешние сервисы mocked |
| PostgreSQL | Отдельный localhost кластер 18; runtime NOSUPERUSER/NOBYPASSRLS, единая TypeORM identity; system PostgreSQL не изменялся |
| Redis | Отдельный localhost экземпляр; queue prefixes тестовые; FLUSHALL/FLUSHDB не выполнялись |
| TypeScript | Backend, portal, student, staff, admin, developer прошли общий typecheck. Student повторён после включения экрана семестра |
| Backend build | `nest build` прошёл |
| Offline worker | Все 6 Node VM сценариев прошли |
| Lint и документация | Root lint, docs lint, AI documentation и boundary guards прошли |
| Инвентаризация | 355 backend routes; обновлена сводная tenant-инвентаризация. Это не 355 выполненных негативных бизнес-сценариев |
| Production dependencies | Audit: high=0, critical=0, moderate=1. Умеренная Nest SSE находка остаётся в ранее описанном ограничении |

Browser-доказательства feature PR остаются отдельными: onboarding и учебный офис проверены через Next → Nest → PostgreSQL с синтетическими данными; semester UI — настоящий Next с API fixtures, backend отдельно через JWT/PG. Совместного browser-прогона всех ролей этой интеграционной ветки пока нет. Локальная сборка student UI компилирует `/semester`, но Windows standalone packaging выдаёт EPERM; Linux CI должен подтвердить упаковку. Production, native devices и live Moodle/СИБИТ/банк/push не проверялись.

## Открытые проверки

Полный audit вместе с dev-инструментами показывает high/critical находки в glob/picomatch/tmp/Vite/Vitest/tinypool/Handlebars/braces/markdown-it. Production gate их не включает; это не основание утверждать чистоту всего dependency tree. Нужен отдельный совместимый upgrade инструментов с повтором проверок, а для braces — оценка upstream fix/альтернативы, поскольку audit не указывает исправленную версию.

Не закрыты перечисленные в [журнале](improvement-progress-2026-10-22.md) бизнес-требования: экспорт/обезличивание, WCAG-аудит, ИНН/модерация/XLSX, P3 и операционные подтверждения. Все внешние отправки остаются default-off. Main и production не менялись; исходные feature PR сохраняются для отдельного ревью.
