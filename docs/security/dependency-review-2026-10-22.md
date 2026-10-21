# Проверка production-зависимостей 22 октября 2026

Снимок для сопровождающего. Исходный GitHub Actions run `39661627809` прошёл build, lint, typecheck, unit и Backend E2E; job Dependency security audit обнаружил две high и одну moderate запись. Это проверка состава зависимостей, а не доказательство эксплуатации уязвимости.

## Исправленные high-записи

Глобальный override закрепляет `follow-redirects` на `1.16.1`; lockfile обновлён без смены других версий. Эта версия исправляет обход очистки чувствительных заголовков при редиректе для array-form headers и regex-метасимволов в именах заголовков. Проблема затрагивала, в частности, транзитивную зависимость legacy `apps/web` → axios; общий override действует на весь workspace.

Источники: [array-form headers](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8), [sensitiveHeaders escaping](https://github.com/advisories/GHSA-8r9p-f939-6h3c), [релиз 1.16.1](https://github.com/follow-redirects/follow-redirects/releases/tag/v1.16.1).

Повторный `pnpm audit --prod --json` по обновлённому lockfile: **high 0, critical 0, moderate 1**. Audit gate в CI не отключался и не исключает эти пакеты.

## Оставшаяся moderate-запись

`@nestjs/core@10.4.22`: [GHSA-36xv-jgw5-4q75](https://github.com/advisories/GHSA-36xv-jgw5-4q75), инъекция полей id/type в SSE, исправление опубликовано для `11.1.18`. Переход на другой major Nest/Express этим небольшим dependency fix не выполняется.

В текущем коде найден один `@Sse`-маршрут: [EventsController.stream](../../apps/backend/src/events/events.controller.ts). Его [EventBusService](../../apps/backend/src/events/event-bus.service.ts) разрешает только типы из `NAPARE_EVENT_TYPES`, заменяет неизвестный тип на `unknown` и удаляет CR/LF/NUL из id перед передачей в SSE. [Тест](../../apps/backend/src/events/event-bus.service.spec.ts) проверяет вредоносные persisted id/type. Это прикладная мера на обнаруженном пути; она не означает, что зависимость обновлена или что будущий SSE-маршрут защищён автоматически.

Следующий major-upgrade требует отдельной совместимой миграции Nest и Express, проверки wildcard middleware, контрактов ошибок и полного HTTP прогона. Moderate-запись сохраняется видимой в audit; порог CI high/critical не изменён.

## Воспроизведение

```powershell
pnpm audit --prod --json
pnpm --filter @napare/backend exec jest --runInBand event-bus.service.spec.ts
```

Результаты относятся к ветке реализации. Production-версии библиотек, маршруты через прокси и события на сервере не проверялись.
