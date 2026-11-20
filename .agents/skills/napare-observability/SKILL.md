---
name: napare-observability
description: "Настраивать и диагностировать логи, health, telemetry, ошибки и метрики NaPare с проверкой прав и минимизацией персональных данных."
---

# Наблюдаемость NaPare

## Назначение и применение

Настраивать и диагностировать логи, health, telemetry, ошибки и метрики NaPare с проверкой прав и минимизацией персональных данных. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `apps/backend/src/health.controller.ts`
- `apps/backend/src/telemetry/telemetry.interceptor.ts`
- `apps/backend/src/telemetry/telemetry.service.ts`
- `apps/backend/src/telemetry/telemetry-sanitize.ts`
- `apps/backend/src/platform-analytics`
- `apps/web-portal/src/components/TelemetryProvider.tsx`
- `scripts/monitor-health.cjs`
- `docs/modules/platform-telemetry.md`
- `docs/architecture/logging.md`

## Рабочий процесс

1. Сформулируйте наблюдаемый отказ и источник сигнала: browser, frontend, Nginx, backend, DB, queue или external delivery. Запишите timestamp, version/SHA и correlation без персональных payloads.
2. Проверьте health semantics и dependency flags; backend database ok не доказывает browser route или delivery. Сопоставьте client request с server log/trace.
3. Прочитайте текущие interceptors, буфер telemetry и normalizePath/sanitizeMetadata. Добавляйте только необходимые структурированные attributes и ограниченные размеры.
4. Проверьте telemetry.read/analytics.read grants, session revocation, retention и privacy lifecycle. Не расширяйте owner диагностику всем admin.
5. Воспроизведите безопасную ошибку на local synthetic данных, проверьте приём, запись/flush, отображение и failure/disabled states; 202 обозначает приём, не доставку в хранилище.
6. Подготовьте runbook: симптом → безопасная проверка → интерпретация → действие в разрешённом scope. Production remediate выполняется только при авторизации.

## Правила разработки

- Не логируйте токены, cookies, query secrets, request bodies, документы или контактные данные; свободный metadata text требует review.
- Sentry MCP — отдельный инструмент чтения ошибок; наличие SDK @sentry/node не означает подключение MCP или настроенный DSN.
- Не увеличивайте retention и не включайте новый массовый сбор без требования и оценки privacy.

## Типичные ошибки

- Санитизировать только ключ password и пропустить email в свободной строке; выбирайте allowlist атрибутов.
- Воспринять отсутствие событий как отсутствие ошибок при выключенном сборе/буфере/отказе записи.

## Критерии качества и проверка

- [ ] telemetry-sanitize/service/interceptor specs; failures/disabled flags/size limits.
- [ ] Synthetic event проходит ожидаемый lifecycle; DB и UI permissions проверены раздельно.
- [ ] Health/browser/network evidence согласован по времени и SHA; журнал/отчёт не содержит секретов/ПД.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

При жалобе Android на вход сопоставьте обезличенные app.open/page.view, refresh HTTP и backend auth errors; не записывайте токены или email пользователя в telemetry.

## MCP и внешние инструменты

Sentry — read-only очищенные issues/traces при авторизации; Chrome DevTools — console/network; DBHub — синтетическое хранилище; GitHub — версия и CI. Не создавайте/изменяйте внешние alert rules без поручения. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

