# Share bundle для разработчиков

## Назначение

Архив `NaPare-dev-bundle-2026-09-16.zip` содержит полный воспроизводимый исходный проект для передачи разработчикам: приложения, пакеты, документацию, Docker-конфигурацию, CI и lockfile зависимостей.

## Что включено

- `apps/`, `packages/`, `infrastructure/`, `docs/`, `.github/`, `scripts/`;
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, конфигурации lint/TypeScript;
- `docker-compose.dev.yml`, `docker-compose.prod.yml`, `.env.example` и инструкции запуска.

## Что намеренно исключено

| Исключение | Причина |
| --- | --- |
| `node_modules/`, `.next/`, `dist/`, `.turbo/`, `coverage/` | Генерируются локально, раздувают архив и не являются исходным кодом |
| `.git/` | История должна передаваться через Git remote, а не копией каталога |
| `.update_stage/` | Временная копия обновления, не часть рабочего проекта |
| `.env`, `.env.*`, кроме `.env.example` | Могут содержать секреты и локальные учётные данные |
| `*.zip` | Чтобы архив не включал себя и вложенные бандлы |

## После распаковки

```powershell
pnpm install
Copy-Item .env.example .env.docker.local
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d --build
```

Перед запуском Docker Mini App соберите его static bundle:

```powershell
pnpm --filter @napare/max-miniapp build
```

Не передавайте `.env.docker.local`, access tokens, database dumps или содержимое Docker volumes через общий архив.

## Проверка перед передачей

```powershell
pnpm --filter @napare/backend exec jest --runInBand
pnpm --filter @napare/max-miniapp test
docker compose --env-file .env.docker.local -f docker-compose.prod.yml ps
```
