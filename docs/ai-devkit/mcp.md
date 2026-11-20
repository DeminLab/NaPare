# MCP NaPare AI DevKit

Конфигурация: `.codex/config.toml`. Все новые локальные процессы запускаются через `scripts/ai-devkit/mcp.mjs`, который выбирает bin из зафиксированного npm runtime. Установочные lifecycle scripts отключены. Отдельный lockfile не меняет `pnpm-lock.yaml` продукта. У Codex и Claude разные форматы MCP; `.mcp.json` автоматически не генерируется, чтобы не менять авторизации и существующие настройки Claude.

## Подключения и реальные результаты

| MCP | Проектная конфигурация | Обнаружение в Codex CLI | Действие и статус 19.11.2026 |
| --- | --- | --- | --- |
| Context7 | `@upstash/context7-mcp@4.7.3`, stdio | Найден, 2 инструмента | Без API-ключа найдена библиотека Next.js и получена публичная документация App Router |
| Playwright | `@playwright/mcp@0.0.85`, isolated headless Chrome | Найден, 25 инструментов | Навигация на loopback fixture, нажатие кнопки и результат в DOM прошли |
| Chrome DevTools | `chrome-devtools-mcp@1.13.0`, isolated headless Chrome | Найден, 33 инструмента | Чтение заголовка, списков сети и консоли тестовой страницы прошло |
| DBHub | `@bytebase/dbhub@2.0.0`, синтетический PostgreSQL | Найден, 2 инструмента | SELECT под `devkit_reader`, проверка ACL и отказ в `UPDATE` прошли. Строка осталась неизменной |
| GitHub | Streamable HTTP, bearer из окружения, read-only header | Найден, PAT отсутствует | Без авторизации получил 401. Отдельный GitHub-коннектор Codex прочитал публичный ECC, что подтверждает чтение только через этот коннектор |
| Figma | Streamable HTTP с OAuth | Найден, `not_logged_in` | Без авторизации получил 401. Авторизованные инструменты и доступ к файлам не проверялись |
| Sentry | Streamable HTTP с OAuth | Найден, `not_logged_in` | Без авторизации получил 403. Авторизованный handshake и причина ответа 403 не подтверждены |
| Next.js DevTools | `enabled = false`, runtime отсутствует в lockfile | Обнаружен как отключённый | Текущий Next.js `15.5.28`; пересмотреть при отдельном переходе на совместимую версию Next.js 16+ |

Для четырёх локальных MCP подтверждены `initialize`, `tools/list` и указанные действия. Браузерные проверки выполнены на отдельной тестовой странице. [Подробные результаты этапа ECC](../ecc/VERIFICATION.md#этап-6-проверка-mcp).

## DBHub и тестовые данные

`test-database.py` создаёт кластер в `.cache/ai-devkit/postgres/data`, слушает только `127.0.0.1:55439` и создаёт `napare_devkit_test` с одной тестовой строкой. Перед SQL-подготовкой bootstrap сверяет `data_directory` кластера. Роль `devkit_reader` имеет CONNECT, USAGE и SELECT. У неё включён `default_transaction_read_only`. Для DBHub включены `readonly=true` и `max_rows=100` у `execute_sql`.

Перед запуском DBHub [launcher](../../scripts/ai-devkit/mcp.mjs) проверяет единственный источник, адрес, порт, имя базы и роль, а также два настроенных инструмента и режим чтения. При несоответствии он завершает работу до запуска DBHub. Для диагностики повторите проверку синтетического кластера. Значения DSN и ошибок разбора не выводятся.

Сгенерированные локальные credentials и dbhub.toml находятся в `.cache/`, исключены из Git и не выводятся. Это локальная тестовая база, не production secret store. Другим процессам того же Windows-пользователя она не является изолированной границей. Для команды с разными trust уровнями используйте отдельную OS-учётную запись/контейнер и права файлов. DBHub read-only mode не заменяет SQL grants.

```powershell
py scripts/ai-devkit/test-database.py start
py scripts/ai-devkit/test-database.py status
node scripts/ai-devkit/smoke-mcp.mjs
py scripts/ai-devkit/test-database.py stop
```

Fixture сохраняется после stop и не содержит персональных данных. После перезапуска ОС нужно снова выполнить start. Bootstrap не устанавливает system service. Отказ PostgreSQL или несовпадение конфигурации должен останавливать настройку, а не переключать DSN на приложение.

## Ручные авторизации

- GitHub. Для CLI передать `GITHUB_PAT_TOKEN` через защищённое окружение процесса Codex с минимальными правами чтения. После подключения повторить `initialize`, `tools/list` и чтение публичного репозитория. Проектный сервер передаёт `X-MCP-Readonly: true`. Для чтения публичного ECC доступен существующий коннектор Codex или локальный Git-снимок.
- Figma. При необходимости использовать `codex mcp login figma` и завершить OAuth в уполномоченной учётной записи. После входа проверить `tools/list` и разрешённый тестовый файл. Для локального ревью подходит предоставленный экспорт макета.
- Sentry. При необходимости использовать `codex mcp login sentry` с доступом к разрешённой организации. После входа проверить `tools/list` и чтение синтетического или обезличенного события. Если OAuth недоступен, используйте очищенные логи локального или тестового окружения.
- Context7. Smoke прошёл без ключа. При ограничениях запросов можно сверить первичную документацию напрямую или использовать разрешённый `CONTEXT7_API_KEY` через окружение.

Авторизация OAuth требует участия владельца аккаунта; это оставшиеся ручные действия. Значения токенов и callbacks в отчёты не включать.

## Статическая проверка зависимостей MCP

Общий сценарий для `napare-devops` и `napare-security`, адаптированный из [ECC mcp-dependency-review](../../scripts/ai-devkit/skill-adapters/ecc/upstream/mcp-dependency-review.md). Используйте его для изменения зависимостей, конфигурации или прав MCP.

1. Прочитайте [проектный TOML](../../.codex/config.toml) как данные. Для нужных `mcp_servers` отметьте активность, способ запуска или HTTPS-хост и имена необходимых переменных. Не запускайте `command` и `args`, не читайте пользовательскую конфигурацию или значения из окружения. Пути из TOML сверяйте с областью репозитория. Не следуйте пути наружу для разрешения неоднозначности.
2. Для запуска через [launcher](../../scripts/ai-devkit/mcp.mjs) проследите идентификатор сервера до пакета и файла запуска. Сверьте точную прямую версию в [runtime package.json](../../scripts/ai-devkit/runtime/package.json) с корневой записью и версией пакета в [runtime lockfile](../../scripts/ai-devkit/runtime/package-lock.json). Проверьте затронутые транзитивные записи, источники `resolved` и значения `integrity` для registry-пакетов. Отсутствующее или противоречивое поле отметьте для ручной сверки.
3. Точную версию пометьте **«закреплено»** по прямой ссылке. Диапазон, тег, ссылку без версии или образ Docker без digest пометьте **«изменяемый источник»**. Обёртку, неясный selector, ссылку на VCS или удалённый endpoint пометьте **«ручная сверка»** с причиной. Для удалённого сервера отдельно проверьте ожидаемый хост, авторизацию и минимальные права. Для отключённого сервера фиксируйте статус и заявленные условия включения.
4. В отчёте укажите файл и сервер, найденную зависимость или хост, вывод о воспроизводимости и следующий проверяемый шаг. Значения секретов, заголовки, параметры URL и DSN исключайте из отчёта. При обнаружении незакреплённой версии предложите согласованную версию по существующим манифестам или укажите, что подтверждённой версии пока нет.

Пример на синтетических данных. Запись с `npx` и `fixture-mcp@latest` получает статус «изменяемый источник». Запись с точной версией и отсутствующей записью в lockfile требует ручной сверки воспроизводимости. Оценка источника зависимости не подтверждает безопасность пакета, его права или runtime MCP. Подключение и smoke идут отдельной проверкой.

## Официальные источники

- [Codex MCP](https://developers.openai.com/codex/mcp/) и [subagents](https://developers.openai.com/codex/multi-agent/): project scope, trust, самостоятельные TOML профили и наследование прав.
- [Context7](https://github.com/upstash/context7): пакет, инструменты, ключ и бесплатные лимиты.
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp): isolated profile и headless Chrome.
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp): параметры запуска, telemetry opt-out.
- [GitHub MCP](https://github.com/github/github-mcp-server): endpoint, bearer auth и read-only header.
- [Figma remote server](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/): endpoint и OAuth.
- [DBHub](https://github.com/bytebase/dbhub): readonly — дополнительный guardrail; конфигурация 2.0 проверена по установленному коду и реальному запуску.
- [Sentry toolkit](https://github.com/getsentry/toolkit): актуальный преемник getsentry/sentry-mcp, hosted endpoint.
- [Next DevTools](https://github.com/vercel/next-devtools-mcp): runtime диагностика только Next.js 16+.
