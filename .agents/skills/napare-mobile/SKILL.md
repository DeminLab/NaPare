---
name: napare-mobile
description: "Разрабатывать мобильные web-сценарии и Android HTTPS WebView оболочку NaPare с проверкой website-owned auth, файлов и жизненного цикла."
---

# Мобильные клиенты NaPare

## Назначение и применение

Разрабатывать мобильные web-сценарии и Android HTTPS WebView оболочку NaPare с проверкой website-owned auth, файлов и жизненного цикла. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `apps/android-webview/app/src/main/java/ru/napare/app/MainActivity.java`
- `apps/android-webview/app/src/main/java/ru/napare/app/TelemetryBeacon.java`
- `apps/android-webview/app/build.gradle`
- `apps/web-portal/src/components/HomeSessionRestore.tsx`
- `apps/web-student/src/lib/api.ts`
- `scripts/build-android.ps1`
- `docs/clients/android-webview.md`
- `docs/clients/student-offline.md`

## Рабочий процесс

1. Определите слой проблемы: responsive web, portal auth/router, WebView lifecycle, bridge, offline cache или native packaging. Не начинайте миграцию в Expo по умолчанию.
2. Проследите launch / → HomeSessionRestore → refresh → кабинет роли. Сайт владеет токенами/маршрутами, Android хранит web storage; смена аккаунта очищает персональный offline cache.
3. Для native правки сохраните HTTPS host allowlist, запрет mixed content/TLS bypass, external links и origin-scoped file bridge.
4. Для web правки проверьте safe areas/keyboard, нижний край экрана, системный Back, поворот, touch targets и слабую сеть.
5. Запустите релевантные web tests и, при изменении Android, Gradle build/lint/JVM tests с существующим script и приватным signing config вне Git.
6. Отдельно пройдите реальное устройство/emulator: холодный запуск, сохранённый вход, refresh, logout, file chooser, ICS, back/rotate/offline. Без устройства прямо укажите этот gap.

## Правила разработки

- В репозитории нет действующего Flutter/iOS клиента; Expo skills применимы лишь к отдельно запрошенной новой реализации.
- Не добавляйте native auth backend, широкие permissions или JavascriptInterface ради обхода сайта.
- APK/keystore/signing JSON/build logs не входят в source-only Git поставку.

## Типичные ошибки

- Считать assembleRelease подтверждением auth после force-close/открытия на устройстве.
- Объявить сохранённый offline plan полной офлайн-копией сайта или гарантировать OS push.

## Критерии качества и проверка

- [ ] Website session restore + account cache lifecycle tests по scope.
- [ ] scripts/build-android.ps1 при доступном SDK/JDK/signing и разрешённой сборке; build/JVM/device evidence раздельно.
- [ ] Реальный viewport/WebView, файлы, keyboard/back/rotate, session persistence и смена аккаунта проверены либо помечены gap.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

Мерцание формы входа после перезапуска требует совместного просмотра MainActivity и HomeSessionRestore, а не только задержки загрузки native UI.

## MCP и внешние инструменты

Playwright — mobile web flow, не физический WebView; Chrome DevTools — web network/session и подключённый debug WebView, если доступен; Context7/официальный Android docs — bridge/lifecycle. Figma — существующий мобильный reference. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

