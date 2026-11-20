# Архитектурная основа NaPare AI DevKit

Снимок исходного кода на 19 ноября 2026 года. Это ориентир для AI-разработки, а не аудит всех бизнес-сценариев и не подтверждение production. Источники истины: `package.json`, `pnpm-lock.yaml`, манифесты приложений, `apps/backend/src/app.module.ts`, конфигурация Compose и код затронутого модуля.

## Стек и рабочая среда

| Слой | Подтверждено в исходниках |
| --- | --- |
| Монорепозиторий | pnpm workspace; `packageManager: pnpm@9.0.0`; Turborepo `^2.0.0`; корневой TypeScript `5.9.3` |
| Активный web | Next.js App Router: `web-portal`, `web-student`, `web-staff`, `web-admin`, `web-developer` |
| Web версии | Манифесты portal/student содержат Next `15.5.27`, root override и lockfile — `15.5.28`; React/React DOM `18.3.1`. При исследовании установленного кода проверять override и `pnpm list`, а не только package приложения |
| Backend | NestJS 10, Express `4.22.1`, TypeORM `^0.3.19` (lockfile `0.3.31`), PostgreSQL driver `pg`; Jest 29, ts-jest, Supertest |
| Асинхронная работа | В зависимостях backend есть BullMQ `^5`, ioredis `^5`; проверять активацию и флаги конкретного сценария, наличие пакета не означает доставку сообщения |
| Данные/инфраструктура | Compose: PostgreSQL `16-alpine`, Redis `7-alpine`; dev дополнительно MinIO. Nginx и production Compose — отдельный контур |
| Мобильный клиент | `apps/android-webview`: Gradle/Android HTTPS WebView, авторизация и role routing принадлежат web. Нативного Flutter приложения нет |
| MAX | Реальные web launch/account flows в `apps/web-portal`; `apps/max-miniapp` и `apps/web` сохранены как legacy и исключены из root dev/build |
| Среда этой установки | Windows NT 10.0.26100, PowerShell; наблюдались Node `v24.11.1`, pnpm `9.15.4`. CI использует Node 20; локальный успех не доказывает CI совместимость |

## Границы приложений и пакетов

- `apps/backend/src/main.ts`: validation pipe с whitelist/forbidNonWhitelisted, общий error filter, response interceptor, CORS и опциональный Sentry по конфигурации. API и DTO проверяются по контроллерам; не менять форматы ответов ради локального экрана.
- `apps/backend/src/app.module.ts`: modular monolith с auth, users, schedule, pair-space, absences, academic, curation, career, requests, notifications и platform-модулями. Университетские операции и управление всей платформой имеют разные границы доступа.
- `apps/backend/src/common/tenant/`: tenant context, проверка DB role и установка tenant database policies. `app.module.ts` разделяет runtime и migrator credentials; не заменять это подключением суперпользователя.
- `apps/backend/src/migrations/`: история схемы и правил доступа. Менять Entity без миграции недостаточно; запуск миграции на production требует отдельной авторизации.
- `packages/ui`: общие компоненты, `WorkspaceShell.tsx`, `workspace-navigation.ts`, `useWorkspaceQuery.ts`, curation UI. Изменения могут затронуть все role workspaces.
- `packages/design-tokens`: `styles.css`, `src/index.ts`, `tailwind.preset.js`; primitive и semantic токены, цветовые состояния, типографика. Здесь находится исходная визуальная система.
- `packages/api-client/src/client.ts` и `types.ts`: общий клиент и контракт web; `offline-event-store.ts` требует отдельной проверки границ локальных данных.
- `packages/shared/src`: общие доменные типы, role constants, validators и formatters. Проверить, используется ли конкретный тип клиентом и backend, прежде чем вводить второй.
- `infrastructure/`, `docker-compose.prod.yml`, `.github/workflows/`: инфраструктура, CI и эксплуатационные настройки. DevKit не меняет их production поведение.

## Существовавшие AI-настройки

До установки DevKit в `.agents/skills/` обнаружены 19 каталогов: banner-design, brand, design, design-motion-principles, design-system, expo-data-fetching, expo-native-ui, expo-project-structure, expo-router, expo-web-to-native, frontend-design, frontend-ui-engineering, responsive-craft, slides, ui-styling, ui-ux-pro-max, vercel-react-best-practices, vercel-react-native-skills, web-design-guidelines. Их наличие не доказывает применимость Expo к текущему Android WebView.

В проекте обнаружен `.codex/hooks.json` с командой `rtk hook codex` для matcher `Bash`. Он сохранён; фактическое срабатывание под текущим Codex/PowerShell этим снимком не подтверждено. Проектные `CLAUDE.md` и `.claude/` при исходном осмотре отсутствовали. Глобальные пользовательские MCP и секреты не копируются в репозиторий. Перечень инструментов текущего чата не равен конфигурации следующего запуска Codex.

## Выявленный разрыв документации

Дополнительно выполнен `codex plugin list --json`: 17 включённых установок — documents, pdf, spreadsheets, presentations, template-creator, codex-app-tools, browser, unified-computer-use, chrome, computer-use, visualize, canva, figma, vercel, github, build-web-apps, supabase. Это инвентаризация пакетов, не доказательство их авторизаций. Старые настройки не удалялись. App-server отдельно предупредил о невалидном существующем `neon-postgres/plugin.json`; эта глобальная установка не исправлялась в проектном DevKit. CLI предупредил об ограничении бюджета описаний Skills и неподдерживаемом PowerShell snapshot; ограничения зафиксированы в `codex-verification.md`.

`docs/architecture/README.md` в исходном состоянии утверждает отсутствие RLS и backend Redis queues. Это расходится с `app.module.ts`, tenant helpers, RLS migrations и зависимостями BullMQ/ioredis. DevKit опирается на код, но не переписывает весь исторический раздел архитектуры. Реальную доступность очереди, политики БД и подключения подтверждать runtime проверкой на синтетическом окружении.

## Безопасная последовательность исследования

1. `AI_CONTEXT.md` → индекс docs → onboarding → Developer Guide.
2. `docs/ai/project-map.md`, `docs/ai/change-safety.md`, source card нужной области.
3. Код маршрута/контроллера → service → tenant/resource checks → Entity/миграции → общий клиент → UI.
4. Найти существующие тесты и CI-команды; определить нужный уровень доказательства.
5. Загрузить один профильный Skill и только необходимые MCP. Для DB — отдельная синтетическая БД с ограниченной ролью.

`docs/ai/change-safety.md` от 31 октября отменяет старые запреты по отдельным путям; нельзя восстанавливать их из памяти. Это не отменяет запрет секретов и требование отдельной авторизации production.
