---
name: napare-release
description: "Подготавливать проверяемую поставку NaPare, состав коммита, changelog, совместимость миграций и план отката; выполнять публикацию только в запрошенном объёме."
---

# Подготовка релиза NaPare

## Назначение и применение

Подготавливать проверяемую поставку NaPare, состав коммита, changelog, совместимость миграций и план отката; выполнять публикацию только в запрошенном объёме. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `docs/process/branching.md`
- `docs/process/definition-of-done.md`
- `docs/deployment/production.md`
- `.github/workflows/ci.yml`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/build-android.ps1`
- `docs/clients/android-webview.md`

## Рабочий процесс

1. Уточните фактический объём авторизации: подготовка, commit, push, release и deployment — отдельные действия. Инвентаризируйте весь status и сравнение с upstream.
2. Отберите исходники и документацию конкретной поставки; сохраните чужие изменения, не добавляйте .env, diagnostic bundles, outputs, APK, .next или node_modules.
3. Проверьте контракты между текущими и обновляемыми клиентами/API, migrations, feature flags, versioning и rollback. Android versionCode/signing рассматривайте отдельно.
4. Запустите релевантные lint/typecheck/tests/build и браузерные acceptance; сохраните exact commands/SHA, failed/skipped и непроверенные уровни.
5. Подготовьте changelog/руководство и явный список preflight действий среды. Не прячьте blocker под формулировкой «готово».
6. При разрешённой публикации используйте согласованную ветку и проверьте remote SHA/CI этого head. Deployment подтвердите только реально выполненной проверкой целевого окружения.

## Правила разработки

- git push не означает deployment, а успешная сборка APK не означает проверку устройства или публикацию RuStore.
- Не делайте force push, reset чужих изменений, автоматический merge или production restart из одного факта подготовки релиза.
- Не сохраняйте private signing config, keystore, токены и production URLs с секретами.

## Типичные ошибки

- Опубликовать только новую feature-ветку, когда пользователь явно требует видимую main; сначала проверьте задачу и ancestry.
- Взять успешный build старого артефакта или не учесть незакоммиченные файлы.

## Критерии качества и проверка

- [ ] git status --short --branch; git diff --stat; git diff --cached --check и состав staging.
- [ ] Релевантные CI-equivalent проверки; отсутствие секретов/артефактов в staged diff.
- [ ] Для разрешённого push: local/remote SHA; для deployment: реальный health + browser route; gaps перечислены.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

Source-only Android исправление поставляется Java/website code и docs; APK, logs и signing config остаются вне Git, device test отмечается отдельно.

## MCP и внешние инструменты

GitHub — читать статус CI и историю release; запись/merge/publish только по поручению. Playwright — acceptance; Sentry — обезличенный post-release сигнал при доступе; DBHub не подключается к production. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

