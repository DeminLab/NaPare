# Онбординг разработчика

Этот документ описывает текущий pnpm/Turborepo монорепозиторий. Для работы с ним нужны Node.js 20+, pnpm 9+ и Docker Compose v2. Нативный Flutter-клиент в репозитории отсутствует; `apps/web` и `apps/max-miniapp` — сохранённые legacy-проекты.

## Сначала прочитайте

1. [README](../README.md) — продукт, быстрый старт и команды.
2. [AI context](../AI_CONTEXT.md) — обязательный порядок изучения репозитория для AI-инструментов.
3. [Project map](ai/project-map.md) — приложения и границы runtime.
4. [Architecture overview](architecture/README.md) и документ нужного модуля.
5. [API guide](api/README.md), если задача меняет API.
6. [Contributing](process/contributing.md) и [definition of done](process/definition-of-done.md) перед отправкой изменений.

## Настройка рабочего дерева

```powershell
git clone https://github.com/DeminLab/NaPare.git
Set-Location NaPare
pnpm install
Copy-Item apps/backend/.env.example apps/backend/.env
# При необходимости замените локальные секреты-заглушки.
docker compose -f docker-compose.dev.yml up -d
pnpm dev
```

Compose development поднимает только PostgreSQL, Redis и MinIO. Root `pnpm dev` запускает backend и активные web-приложения. Порты и отдельные команды перечислены в [README](../README.md#локальная-разработка). Не публикуйте development-данные и не используйте эти значения в production. Корневой `.env.example` предназначен для production Compose, а не для локального backend.

Для отдельного приложения используйте `pnpm dev:portal`, `pnpm dev:student`, `pnpm dev:staff`, `pnpm dev:admin` или `pnpm dev:developer`. Backend можно запустить отдельно командой `pnpm --filter @napare/backend dev`.

## Изменение API или схемы

- API-контракт генерируется из NestJS-контроллеров и DTO. Обновите код и профильную страницу в `docs/modules/`; OpenAPI доступен на `/api/v1/docs`.
- Сущности и TypeORM-миграции находятся в `apps/backend/src`. В production Compose ожидающие миграции выполняются при запуске backend; перед выпуском проверьте миграцию и предусмотрите резервную копию БД.
- При изменении маршрутов, переменных окружения, Compose или Nginx синхронизируйте `docs/deployment/production.md` и соответствующую страницу `docs/ops/`.
- Не редактируйте сгенерированную OpenAPI-спецификацию вручную.

## Перед отправкой изменений

Выполните проверки, относящиеся к изменённым файлам. Для изменений документации запустите:

```powershell
node scripts/verify-ai-documentation.cjs
node scripts/verify-role-workspace-boundaries.cjs
pnpm lint
```

Для backend дополнительно используйте тесты/проверки из [руководства тестирования](ops/testing.md); для production-поведения отдельно подтверждайте результат на целевом окружении.

## Исторические материалы

Документы в `docs/archive/`, датированные планы в `docs/superpowers/` и хронология в `docs/project-log/` объясняют прежние решения и поставки. Они не задают текущее состояние приложения. Для текущей реализации ориентируйтесь на код, [карту проекта](ai/project-map.md), актуальные документы модулей и [деплой-гайд](./deployment/production.md).
