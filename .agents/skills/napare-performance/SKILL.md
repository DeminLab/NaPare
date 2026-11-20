---
name: napare-performance
description: "Измерять и улучшать frontend, NestJS и PostgreSQL производительность NaPare по воспроизводимому сценарию и baseline."
---

# Производительность NaPare

## Назначение и применение

Измерять и улучшать frontend, NestJS и PostgreSQL производительность NaPare по воспроизводимому сценарию и baseline. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `packages/ui/src/WorkspaceShell.tsx`
- `packages/ui/src/useWorkspaceQuery.ts`
- `apps/backend/src/schedule/schedule.service.ts`
- `apps/backend/src/my-day`
- `apps/backend/src/analytics/analytics.service.ts`
- `packages/api-client/src/client.ts`
- `apps/web-student/next.config.js`

## Рабочий процесс

1. Определите симптом и метрику: время навигации/interaction, payload, query latency, memory или размер bundle. Запишите route, данные, viewport, устройство и сборку.
2. Снимите baseline до оптимизации: browser trace/network, API latency и query plan на синтетическом репрезентативном объёме.
3. Найдите конкретную причину: waterfall, N+1, лишний refetch, тяжелый client boundary, list rendering, отсутствие подходящего индекса или кэш с неверным scope.
4. Сделайте одно измеримое изменение, сохранив права и свежесть данных. Cache key должен учитывать tenant, роль/пользователя и параметры; logout/revoke инвалидирует чувствительный кэш.
5. Повторите тот же сценарий и проверьте корректность при ошибке, пустых данных, параллельных запросах и смене аккаунта.
6. Запишите до/после с методикой, разбросом и ограничениями; если эффект не подтверждён, не заявляйте ускорение.

## Правила разработки

- Не добавляйте memo/cache без наблюдаемой причины и понятного срока жизни.
- Не снимайте нагрузку с production и не запускайте платные внешние тесты без разрешения.
- Метрики dev-server и production build различаются; lab trace не равен полевым Web Vitals.

## Типичные ошибки

- Измерить второй прогон с прогретым кэшем против холодного baseline: выровняйте условия.
- Ускорить query удалением tenant-filter либо кэшировать чужой ответ: проверяйте scope и негативные контроли.

## Критерии качества и проверка

- [ ] Baseline и повтор описывают одно окружение/данные; latency/error count и payload записаны.
- [ ] Затронутые unit/typecheck/build; SQL plan и индексы проверены на тестовой БД.
- [ ] Playwright функциональный regression; Chrome trace подтверждает конкретный эффект, device/production gaps отмечены.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

Для медленного расписания сначала измерьте schedule.service запросы и client waterfalls; pagination/индекс выбирайте по плану, а не по предположению.

## MCP и внешние инструменты

Chrome DevTools — performance trace/network; Playwright — повторяемое действие; DBHub — EXPLAIN SELECT тестовых данных; Sentry — обезличенные traces. Context7 — правила cache/rendering именно установленной Next версии. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

