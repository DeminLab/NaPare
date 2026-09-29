# Мониторинг

## Настроенные в репозитории сигналы

- Backend health endpoint: `GET /api/v1/health` (см. [DEPLOY.md](../../DEPLOY.md) для опубликованного Compose маршрута).
- Docker Compose service status и stdout/stderr logs: `docker compose ps`, `docker compose logs --tail 100 <service>`.
- Backend Sentry reporting включается при установленном `SENTRY_DSN`; отсутствие переменной отключает отправку в Sentry.
- CI публикует результаты проверок как GitHub Actions artifacts согласно workflow в `.github/workflows/`.

## Не настроено как текущий observability stack

В repository deployment нет Prometheus, Grafana, Loki, PostHog/Amplitude, web/mobile Sentry или заданных пользовательских alert rules. Метрики и пороги из старых вариантов мониторинга не являются работающими алертами. Если эти сервисы появятся, добавьте configuration, privacy/retention решения, владельца и проверку доставки сигнала до публикации runbook.

Публичная доступность и TLS проверяются отдельно от Docker health: используйте разделы Nginx/DNS/TLS в корневом [DEPLOY.md](../../DEPLOY.md).
