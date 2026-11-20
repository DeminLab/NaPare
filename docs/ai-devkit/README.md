# NaPare AI DevKit

Проектная среда AI-разработки. Проверено 19 ноября 2026 года на Windows, Codex CLI 0.146.0, Node 24.11.1, pnpm 9.15.4, Python 3.10.8 через `py`. Системный Python не менялся. Версия pnpm рабочего окружения отличается от `packageManager: pnpm@9.0.0`; DevKit не меняет эту настройку проекта.

## Состав и источники правды

- [Архитектура и инвентаризация](architecture.md): реальные приложения, пакеты, версии и расхождения документации с кодом.
- [Рабочий процесс и UI-стандарт](workflow.md): полный цикл, короткий цикл, приоритет дизайна NaPare.
- [Контракты 12 агентов](agents.md), файлы `.codex/agents/*.toml`.
- [Техническая память проекта](project-memory.md) — источники, обновление записей и восстановление задачи.
- [Сторонние Skills](vendor-skills.md), [lock manifest](vendor-skills.json), [проверки поставщика](vendor-verification.json).
- [MCP, права и авторизации](mcp.md).
- [Результаты проверки Codex](codex-verification.md), [итог установки](verification.md).

Корневые `AGENTS.md` и `AI_CONTEXT.md` задают порядок работы. `CLAUDE.md` ссылается на те же правила. Собственные Skills находятся в `.agents/skills/napare-*/SKILL.md`, загружаются адресно. Claude Code может читать их по этим путям; автоматическая discovery Claude не проверена. Полные Claude plugins и их hooks не копируются.

## Установка для команды

Нужны Git, Node 24 LTS, npm, Python 3.10+ и актуальный Codex. Для браузерных проверок нужен системный Google Chrome. Для DBHub нужен отдельный локальный PostgreSQL с `initdb`, `pg_ctl`, `psql`; установка PostgreSQL не входит в bootstrap. DevKit runtime требует Node >=22.5, хотя основному проекту достаточно Node 20+.

```powershell
# Из корня checkout; ничего не публикует и не меняет production.
./scripts/ai-devkit/install.ps1 -StartTestDatabase -Smoke
```

Повторный запуск использует `npm ci --ignore-scripts` и manifest сторонних Skills. Пользовательские файлы не перезаписываются: при несовпадении управляемого файла installer останавливается с конфликтом. Глобальная конфигурация Codex/Claude не изменяется. Новая `.codex/config.toml` поставляется в Git; при переносе в существующий другой checkout сравнить и объединить её с текущей, не заменять файл вслепую.

Linux без PowerShell:

```bash
npm ci --prefix scripts/ai-devkit/runtime --ignore-scripts --no-audit --no-fund
python3 scripts/ai-devkit/install-vendor-skills.py
python3 scripts/ai-devkit/test-database.py start --pg-bin /usr/lib/postgresql/18/bin
node scripts/ai-devkit/verify.mjs
node scripts/ai-devkit/smoke-mcp.mjs
```

Linux-команды приведены для команды; фактически проверена Windows. PostgreSQL 18 здесь нужен лишь для независимого synthetic fixture; приложение по-прежнему использует PostgreSQL 16 в Compose. При отсутствии PostgreSQL выполнить bootstrap без `-StartTestDatabase` и `-Smoke`, затем настроить fixture; DBHub будет сообщать об отсутствии `.cache/ai-devkit/dbhub.toml`. Не подставлять DSN приложения.

После установки открыть новый чат Codex в доверенном checkout. Не обходить project trust, sandbox или запросы клиента. Сессия, открытая до установки, не обязана обновлять каталог автоматически. Проверить `codex mcp list`; это инвентаризация конфигурации, а не health check. Для runtime использовать smoke-скрипт.

## 20 проектных Skills

| Skill | Область |
| --- | --- |
| napare-architect | Границы монорепозитория, ADR, масштабирование |
| napare-frontend | Ролевые Next.js приложения, API-клиент |
| napare-backend | NestJS, DTO, права и бизнес-логика |
| napare-design-system | Общие UI и дизайн-токены |
| napare-ui-ux | Реальные сценарии, композиция, состояния |
| napare-security | Tenant, multi-role, RLS, персональные данные |
| napare-database | TypeORM, PostgreSQL, миграции и индексы |
| napare-qa | Unit, E2E и браузерные доказательства |
| napare-devops | Compose, Nginx, CI и эксплуатация |
| napare-performance | Измерение frontend/backend производительности |
| napare-analytics | События продукта и разграничение аналитики |
| napare-product-manager | Требования, приоритеты, критерии приёмки |
| napare-code-review | Доказательный review и регрессии |
| napare-release | Миграции, release checks, rollback |
| napare-1c-integration | Контракт и проектирование интеграции 1С |
| napare-accessibility | Клавиатура, семантика, контраст, формы |
| napare-documentation | Документы модулей и источники правды |
| napare-mobile | Android WebView и мобильные веб-сценарии |
| napare-social | PairSpace, чат, контент и доступ |
| napare-observability | Логи, метрики, telemetry и Sentry |

## Примеры запросов

```text
$napare-backend: проследи endpoint расписания от DTO до tenant query.
Сначала покажи границы доступа и существующие тесты. Пока без изменений.

$napare-ui-ux: улучши указанный экран web-staff по существующим tokens.
Покажи loading/error/empty состояния, затем проверь мобильную ширину в Playwright.

$napare-code-review: проверь diff этой ветки; подтверждай каждую проблему
ссылкой на код и воспроизводимым сценарием. Исправления не вносить.

Прочитай .codex/agents/database-engineer.toml и исследуй только synthetic
DBHub fixture; не подключай .env приложения и реальные данные.
```

## Добавление Skills и обновление

Новый проектный Skill: отдельная папка `.agents/skills/napare-<область>/`, YAML `name`/`description`, узкий триггер, реальные источники, workflow, ошибки, критерии, пример, MCP и проверка. Ориентироваться на существующие 20 навыков. Добавить точный Skill в ожидаемый список `verify.mjs`, если он становится обязательным. Сначала проверить пути и metadata, затем реальный сценарий в новом чате.

Для стороннего обновления сначала читать официальный diff и лицензии, затем менять полный commit и file SHA в manifest. Управляемые изменённые файлы архивировать вне Git, сравнить и перенести обновление вручную. Не удалять каталог для обхода конфликта без просмотра изменений. Для npm обновить точные версии `runtime/package.json`, lockfile, выполнить `npm audit`, offline verifier и MCP smoke. `latest` при старте MCP не используется. Архивы GitHub проверяются по SHA файлов; это integrity, не криптографическое подтверждение личности автора.

## Отключение и восстановление

Для конкретного MCP поставить `enabled = false` в его проектной таблице, затем открыть новый чат. Для полного обратимого отключения переместить созданные DevKit `.codex/config.toml`, `.codex/agents/` и новые папки Skills в локальную резервную папку вне поиска клиента; четыре существовавших Skills и `.codex/hooks.json` сохранять. Список управляемых Skills указан в manifest; не удалять всю `.agents` или пользовательскую `~/.codex`.

Остановить только тестовый кластер: `py scripts/ai-devkit/test-database.py stop`. Данные fixture сохраняются. Для восстановления вернуть файлы из резервной копии или Git, запустить bootstrap, затем при необходимости авторизации. Секреты/credentials и OAuth не восстанавливать через Git: локальные test credentials находятся в игнорируемой `.cache/ai-devkit/postgres/`, OAuth хранит сам клиент.

## Автоматизация

Отдельный workflow `.github/workflows/ai-devkit.yml` устанавливает изолированный runtime без lifecycle scripts, восстанавливает Skills, проверяет метаданные/пины/секреты и npm audit high+. Существующий CI продолжает lint, typecheck, unit/E2E и сборки продукта. Внешний CI ещё не запускался: push не выполнялся. Новые hooks не устанавливаются; существующий RTK hook сохранён, его срабатывание не подтверждено. Mandatory gate реализован скриптом и CI, не обещанием в инструкции.
