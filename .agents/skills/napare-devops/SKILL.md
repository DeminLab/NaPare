---
name: napare-devops
description: "Проверять зависимости Codex MCP, Docker Compose, Nginx, CI и инфраструктуру NaPare."
---

# Инфраструктура NaPare

## Назначение и применение

Изменять и диагностировать Docker Compose, Nginx, CI и локальную инфраструктуру NaPare с явной границей production-действий. Применяйте автоматически при соответствующей задаче; загрузите только этот навык и необходимые профильные документы. Начните с `AI_CONTEXT.md` и текущего `AGENTS.md`. Все пути ниже относительно корня репозитория; команды выполняются из корня, если не указано иное.

## Источники проекта

- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `infrastructure/docker/web.Dockerfile`
- `infrastructure/nginx/default.conf`
- `infrastructure/control/agent.mjs`
- `.github/workflows/ci.yml`
- `docs/deployment/production.md`
- `docs/ops/cicd.md`

## Рабочий процесс

Для проверки версии, launcher или lockfile Codex MCP используйте [статическую проверку зависимостей MCP](../../../docs/ai-devkit/mcp.md#статическая-проверка-зависимостей-mcp). Анализируйте конфигурацию как данные и фиксируйте результат отдельно от запуска сервера.

1. Установите ОС, Docker context, compose file, текущий git SHA и цель операции. Прочитайте service dependencies, healthchecks, volumes и переменные без вывода секретов.
2. Разделите local dev (PostgreSQL/Redis/MinIO) и production stack с frontend/Nginx/backend. Host browser не разрешает Docker hostname backend.
3. Сделайте минимальную конфигурационную правку; сохраните порты, маршруты, health, volume data и runtime/migration DB роли.
4. Проверьте compose config --quiet, Nginx syntax в подходящем контейнере и затронутые CI scripts. На Windows используйте PowerShell native operations.
5. Если запуск разрешён, последовательно соберите нужные сервисы и проверьте ps/logs/health плюс browser-facing route. После SIGBUS оцените память/последовательную сборку вместо бессмысленных retries.
6. Документируйте точные команды, backup/rollback и различие source/build/container/browser/production evidence.

## Правила разработки

- Production deployment, restart, изменение сервера, DNS или секретов требует пользовательского разрешения на это действие.
- Не выполняйте down -v для ремонта auth; volumes содержат данные. Не сохраняйте .env, bundles, logs или build output в Git.
- Не дублируйте pnpm version в pnpm/action-setup, если packageManager уже задаёт версию; pnpm-lock должен быть frozen в CI.

## Типичные ошибки

- Health backend назвать здоровьем всего сайта: проверьте Nginx, frontend и внешний route.
- Считать Windows standalone EPERM успешной сборкой; записывайте фактический exit status.

## Критерии качества и проверка

- [ ] docker compose -f docker-compose.dev.yml config --quiet и production config при доступных локальных значениях.
- [ ] node --test infrastructure/control/agent.test.mjs при изменении host-agent; соответствующий CI job.
- [ ] Health и маршруты проверены только там, где запуск действительно состоялся; production непроверен без разрешённой проверки.
- [ ] Итог перечисляет изменённые файлы, подтверждённые результаты и пробелы. Source/static, build, browser, database, device, deployment и production evidence различаются.

## Пример NaPare

При Nginx 502 сначала сопоставьте контейнеры frontend/backend и upstream; успех /api/v1/health сам по себе не закрывает сбой portal.

## MCP и внешние инструменты

GitHub — read-only CI/logs конкретного SHA; Sentry — очищенные ошибки; Context7 — Docker/Nginx/Next документация. Chrome DevTools нужен для browser-facing запроса, а не доказательства контейнерного health. Используйте только реально доступный и настроенный инструмент. Если нужна авторизация или перезапуск клиента, завершите независимые локальные этапы и укажите точный blocker; не утверждайте, что подключение проверено. При спорной или меняющейся семантике используйте актуальный первичный источник и указывайте проверенную версию.

