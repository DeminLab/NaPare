# Структура проекта

Этот документ перечисляет текущие верхнеуровневые области. Для файловой карты используйте root AI_CONTEXT и source cards; точный список файлов проверяйте в checkout.

## Активные приложения

| Путь | Назначение |
| --- | --- |
| apps/backend | NestJS API |
| apps/web-portal | Публичный сайт, login и MAX Bridge entry |
| apps/web-student | Студенческий web/PWA |
| apps/web-staff | Рабочая поверхность преподавателя/сотрудника |
| apps/web-admin | Кабинет управления ВУЗом |
| apps/web-developer | Техническая поверхность разработчика |

apps/web и apps/max-miniapp — legacy проекты, исключённые из стандартных root dev/build команд и production Compose. Нативного Flutter приложения нет. Смотрите [AI project map](../ai/project-map.md) и [client guide](../clients/max-miniapp.md).

## Общие области

- packages/: shared contracts, API-client package, design tokens and UI.
- apps/backend/src/: feature modules, auth/common/tenant policy, entities, TypeORM migrations and API bootstrap.
- docs/: product, code architecture, API/database, UI specifications, operations and AI source cards.
- infrastructure/ and deploy/: Docker build support and Nginx configuration/templates.
- scripts/: repository validation, demo/bootstrap and export utilities.
- .github/workflows/: CI and staging deployment workflows.
- docker-compose.yml and docker-compose.*.yml: development/production service definitions.

## Authoritative file maps

The current backend directory is too large for a hand-maintained exhaustive tree. Use source control/search for the exact current files and the module pages/source cards for orientation:

- Backend: apps/backend/src and docs/architecture/backend-architecture.md
- Apps and safe-change boundaries: docs/ai/project-map.md and root AGENTS.md
- Build scripts: root package.json and workspace package.json files
- Database schema: backend entities and apps/backend/src/migrations
- Runtime/deployment: Compose files, Nginx configs and root docs/deployment/production.md
- API: live NestJS Swagger generated from controller/DTO code

Older detailed folder trees formerly embedded in this document included paths such as Prisma, Flutter and Kubernetes that are not present in the current repository. They are removed here to avoid presenting a stale tree as current.
