# Снимок проекта и аудит документации

**Проверено:** 2026-09-29

Дополнение от 2026-10-16: этот документ сохраняет исторический снимок. Кураторство, управление платформой, Android и результаты текущих проверок описаны в [новой сверке](project-log/2026-10-16-repository-sync.md).
**Назначение:** зафиксировать состояние репозитория на момент аудита. Это снимок файлов и конфигурации, а не отчёт о доступности staging/production.

## Текущая структура

- Монорепозиторий на pnpm 9 и Turborepo.
- Backend: NestJS, TypeORM, PostgreSQL; схема меняется миграциями в `apps/backend/src/migrations/`.
- Активные Next.js приложения: `web-portal`, `web-student`, `web-staff`, `web-admin`, `web-developer`.
- `apps/web` и отдельный `apps/max-miniapp` сохранены как legacy и исключены из обычных root dev/build команд. MAX вход осуществляется через сайт `web-portal`.
- Общие пакеты расположены в `packages/`; deployment templates и runtime поддержка — в `infrastructure/`, `deploy/`, Compose и `docs/deployment/production.md`.

Подробная карта: [AI project map](ai/project-map.md), [architecture index](architecture/README.md), [repository deployment runbook](./deployment/production.md).

## Реализация и границы

- Доступ к данным вуза обеспечивается backend tenant context, guards и проверками области ресурса. Миграции не включают PostgreSQL RLS policies.
- Production Compose содержит backend, web-приложения, PostgreSQL и Redis. Наличие Redis в Compose не означает использование backend очередей/клиента Redis.
- Moodle Web Services настраивается через backend и шифрует сохранённый token при заданном `CONNECTOR_ENCRYPTION_KEY`; интеграция не синхронизирует Moodle content.
- MAX `initData` проверяется backend-ом; успешный локальный аудит не доказывает конфигурацию бота или вход через реальный MAX-клиент.
- Push delivery, S3 adapter, PostHog, Grafana и Kubernetes не являются действующими интеграциями текущего deployment.
- Основные актуальные источники — исходный код, TypeORM migrations, `package.json`, Compose, GitHub workflows и `docs/deployment/production.md`. При расхождении проектных заметок приоритет у них.

## Проверка документации

В дереве найдено 596 Markdown/MDX/RST/TXT/YAML файлов: 308 в `docs/`, 263 в `.agents/`, 4 в `deliverables/`, 9 в корне и 12 в прочих директориях. `.agents/` содержит skill reference материалы, которые не являются спецификацией продукта и не переписываются в этом аудите. Аудит проекта охватывает `docs/`, root entry docs, first-party deployment/workflow docs и deliverables. Источники для сверки: manifests, backend entities/migrations/controllers/services, frontend routes, Compose, `.github/workflows/` и `docs/deployment/production.md`. Исторические решения и спецификации сохраняются с маркировкой статуса; юридические документы остаются незаполненными черновиками.

Статические проверки ниже будут отмечены только после выполнения. Они не подтверждают runtime, юридическую экспертизу или production deployment.

### Результаты проверки

- Markdown local links: passed; 323 first-party Markdown files scanned, 0 broken links.
- `node scripts/verify-ai-documentation.cjs`: passed (550 Markdown files, 199 source cards).
- `node scripts/verify-role-workspace-boundaries.cjs`: passed.
- `pnpm lint`: passed.
- `git diff --check`: reports pre-existing blank lines at EOF in `docs/deliverables/educational-solutions/CASE-COMPLIANCE.md` and `README.md`; preserved as pre-existing user changes.

## Обновлять этот снимок

При изменениях состава приложений, ORM/migrations, ролей, интеграций, deployment/CI обновите этот файл и соответствующие источники из [reading order](ai/reading-order.md). Не добавляйте сюда непроверенные сведения об инфраструктуре или статусе релиза.
