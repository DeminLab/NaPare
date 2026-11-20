---
name: napare-analytics
description: "Изменять продуктовые метрики, события и аналитические интерфейсы NaPare с tenant scope, согласием и проверяемой семантикой данных."
---

# Продуктовая аналитика NaPare

## Назначение и применение

Изменять продуктовые метрики, события и аналитические интерфейсы NaPare с tenant scope, согласием и проверяемой семантикой данных. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `apps/backend/src/analytics/analytics-policy.ts`
- `apps/backend/src/analytics/analytics.service.ts`
- `apps/backend/src/analytics/analytics.interceptor.ts`
- `apps/backend/src/telemetry/telemetry-sanitize.ts`
- `apps/backend/src/telemetry/telemetry.service.ts`
- `apps/web-student/src/lib/telemetry.ts`
- `docs/modules/product-analytics.md`
- `docs/modules/platform-telemetry.md`
- `apps/backend/test/product-analytics.e2e-spec.ts`

## Рабочий процесс

1. Определите вопрос продукта и формулу: единица учёта, числитель/знаменатель, период, cohort, timezone и доступная роль. Не путайте вовлечённость с успеваемостью/трудоустройством.
2. Разделите university product analytics и owner platform telemetry: это разные scopes, permissions и сбор данных.
3. Проверьте analyticsConfiguration: product daily activity включается явной настройкой и allowlist организаций. Не включайте сбор всем tenant автоматически.
4. Для события выберите существующее имя/схему, минимальные attributes, нормализацию path и sanitization; исключите тексты сообщений, документы, email и токены.
5. Добавьте synthetic fixtures для нулевого знаменателя, границы периода, повторов, чужой организации, выключенного сбора и privacy lifecycle.
6. Проверьте API и график на тех же fixtures; объясните null/неизвестно/0, лаги буфера и ограничения retention; обновите описание метрики.

## Правила разработки

- Не заменяйте отсутствующую статистику случайными значениями или UI mock при реальном API.
- sanitizeMetadata фильтрует имена ключей и ограничивает размер, но не гарантирует, что свободный текст безопасен; проектируйте allowlisted payload.
- Platform telemetry права analytics.read/telemetry.read не выводятся из факта университетского администратора.

## Типичные ошибки

- Принимать 202 телеметрии за гарантию записи: буфер асинхронен.
- Путать числа заданий/заявок с фактом трудоустройства или считать null равным нулю.

## Критерии качества и проверка

- [ ] analytics-policy/interceptor и telemetry-sanitize specs; product-analytics e2e на отдельной БД.
- [ ] Формула сверена вручную на малом synthetic наборе; tenant A/B и disabled collection проверены.
- [ ] Privacy export/deletion/retention учтены; данные графика соответствуют HTTP и доступной роли.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

Новая weekly activity метрика должна явно определять cohort/даты и возвращать null при отсутствии допустимого знаменателя; chart показывает недостаточность данных.

## MCP и внешние инструменты

DBHub — агрегаты только синтетической БД; Playwright — UI и роли; Sentry — ошибки, не источник продуктовой истины; Context7 — API используемой библиотеки. Во внешние инструменты не выгружайте студентские события. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

