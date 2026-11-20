---
name: napare-database
description: "Проектировать и проверять TypeORM Entity, PostgreSQL миграции, индексы и tenant RLS NaPare на изолированных данных."
---

# PostgreSQL и миграции NaPare

## Назначение и применение

Проектировать и проверять TypeORM Entity, PostgreSQL миграции, индексы и tenant RLS NaPare на изолированных данных. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `apps/backend/src/config/database.config.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/migrations`
- `apps/backend/src/common/tenant/tenant-database.ts`
- `apps/backend/src/common/tenant/tenant-context.ts`
- `docs/database/schema-overview.md`
- `docs/decisions/0008-tenant-rls-organization-id.md`
- `apps/backend/test/tenant-database.fixture.ts`

## Рабочий процесс

1. Найдите Entity, отношения, migration history и запросы потребителей; текущую схему подтверждайте только на разрешённой тестовой БД.
2. Зафиксируйте expand/contract переход organizationId и совместимость со старыми universityId ожиданиями. Проверьте policies, foreign keys и область tenant.
3. Спроектируйте up/down, поведение на существующих данных, unique/index и возможные блокировки; массовые преобразования отделяйте от DDL при необходимости.
4. Учитывайте startup AppModule: runtime роль проверяется на невозможность bypass RLS, production migrations используют отдельные DB_MIGRATION_*; development synchronize выполняет особый policy tail.
5. Прогоните миграцию на новой и предшествующей синтетической схеме, проверьте данные, повторный запуск runner и rollback где он безопасен.
6. Оцените запросы через EXPLAIN на синтетическом объёме; обновите документ схемы и release/rollback инструкции.

## Правила разработки

- Не запускайте миграции, synchronize, fixture reset или EXPLAIN ANALYZE записи на рабочей БД.
- Для чтения через DBHub используйте отдельную read-only роль; migration credentials не должны попадать в конфигурацию MCP.
- Новый tenant-owned table требует политики и startup invariant; индекс выбирайте по реальному WHERE/JOIN/ORDER BY.

## Типичные ошибки

- Изменить POSTGRES_PASSWORD в .env и ожидать смены роли существующего volume: это отдельная операция, не миграция приложения.
- Считать пропущенный fixture test успешным тестом; проверьте env-префикс и фактический запуск assertions.

## Критерии качества и проверка

- [ ] pnpm --filter @napare/backend exec tsc --noEmit; entity/migration unit specs.
- [ ] Изолированный pnpm test:e2e с нужной *_TEST_DATABASE_URL, без вывода её значения.
- [ ] up/совместимость/down или явное ограничение отката; чужой tenant, runtime role и query plan проверены.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

Новая таблица импорта должна следовать import-run.entity.ts и миграциям tenant policy, сохранять organizationId и иметь индекс под реальные фильтры журнала.

## MCP и внешние инструменты

DBHub — схема/EXPLAIN SELECT синтетической БД; Context7 — TypeORM и PostgreSQL конкретных версий; GitHub — review миграции. До подключения убедитесь в адресе, имени БД и роли без печати пароля. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

