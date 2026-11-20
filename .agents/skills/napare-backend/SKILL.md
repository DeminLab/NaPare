---
name: napare-backend
description: "Изменять NestJS API и бизнес-логику NaPare, DTO, события и интеграции с проверкой tenant scope и обратной совместимости."
---

# Backend NaPare

## Назначение и применение

Изменять NestJS API и бизнес-логику NaPare, DTO, события и интеграции с проверкой tenant scope и обратной совместимости. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `apps/backend/src/app.module.ts`
- `apps/backend/src/main.ts`
- `apps/backend/src/auth/interfaces/authenticated-user.interface.ts`
- `apps/backend/src/common/guards/roles.guard.ts`
- `apps/backend/src/common/tenant/tenant-context.ts`
- `apps/backend/src/schedule/schedule.controller.ts`
- `docs/api/README.md`
- `docs/architecture/error-handling.md`

## Рабочий процесс

1. Найдите controller → DTO → service → repository, регистрацию Module и всех вызывающих клиентов. Проверьте путь с глобальным /api/v1, guards и status codes.
2. Зафиксируйте инварианты: активная организация, эффективные роли, ownership, доступ к группе/предмету. Используйте server identity, не доверяйте organizationId из тела.
3. Измените минимальный существующий метод, сохранив валидацию входов, транзакционность и формат ошибок. Для связей проверьте принадлежность обеих сторон tenant.
4. При изменении схемы подключите napare-database; при внешних side effects учитывайте retry, idempotency и частичный отказ.
5. Обновите OpenAPI decorators/DTO, общий клиент и документ модуля; не правьте вручную сгенерированный контракт.
6. Добавьте содержательные unit/regression tests и HTTP/DB проверку нужной границы на изолированной БД. Выполните typecheck, lint и backend build.

## Правила разработки

- TypeORM query через нестандартный repository/raw SQL требует отдельной проверки tenant wrapper и транзакционного контекста.
- RolesGuard использует user.roles с fallback user.role; не отменяйте это условием на один enum.
- Не логируйте тело auth, токены, письма и персональные документы; обрабатывайте ожидаемые ошибки через Nest exceptions.

## Типичные ошибки

- Проверить только наличие JWT и считать объект доступным: нужны tenant и ownership проверки.
- Добавить backend endpoint без клиентского вызова/DTO либо вернуть 200 при фактическом частичном отказе.

## Критерии качества и проверка

- [ ] pnpm --filter @napare/backend exec tsc --noEmit; pnpm lint; pnpm --filter @napare/backend build.
- [ ] pnpm --filter @napare/backend exec jest --runInBand --runTestsByPath <затронутый spec>.
- [ ] Позитивный HTTP и негативный чужой tenant/роль; skips DB tests обозначены как непроверенные.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

Изменяя GET pair-spaces/:lessonId/timeline, сопоставьте PairSpaceController, PairSpaceService и subject scope; тест чужого lessonId должен проверять отказ без раскрытия материалов.

## MCP и внешние инструменты

Context7 — NestJS/TypeORM документация для lockfile; DBHub — read-only анализ изолированной схемы; Sentry — обезличенная ошибка и stack trace. Перед отправкой наружу очищайте traces от персональных данных. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

