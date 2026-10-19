# Мониторинг

## Настроенные в репозитории сигналы

- Backend health endpoint: `GET /api/v1/health` (см. [docs/deployment/production.md](../deployment/production.md) для опубликованного Compose маршрута).
- Docker Compose service status и stdout/stderr logs: `docker compose ps`, `docker compose logs --tail 100 <service>`.
- Docker Nginx пишет журнал безопасности с реальным IP, временем, URI, статусом и User-Agent для ответов `401`, `403`, `404`, `429`, `5xx` и успешных изменяющих запросов к `/api/v1/platform/` и `/api/v1/admin/`.
- Production Compose ограничивает локальные журналы backend и Nginx пятью файлами по 10 МБ на сервис.
- Backend Sentry reporting включается при установленном `SENTRY_DSN`; отсутствие переменной отключает отправку в Sentry.
- CI публикует результаты проверок как GitHub Actions artifacts согласно workflow в `.github/workflows/`.

## Не настроено как текущий observability stack

В repository deployment нет Prometheus, Grafana, Loki, PostHog/Amplitude, web/mobile Sentry или заданных пользовательских alert rules. Метрики и пороги из старых вариантов мониторинга не являются работающими алертами. Если эти сервисы появятся, добавьте configuration, privacy/retention решения, владельца и проверку доставки сигнала до публикации runbook.

Журналирование статусов и Docker rotation сами по себе не создают уведомления. Проверяйте ошибки и подозрительные обращения через `docker compose logs --since 24h nginx backend`; при инциденте сначала сохраните исходные журналы на сервере и только затем перезапускайте контейнеры или меняйте конфигурацию.

Публичная доступность и TLS проверяются отдельно от Docker health: используйте разделы Nginx/DNS/TLS в корневом [docs/deployment/production.md](../deployment/production.md).
