# Мониторинг

## Метрики

| Метрика | Инструмент | Alert |
|---------|------------|-------|
| CPU/Memory | Prometheus | > 80% |
| API response time | Prometheus | p95 > 500мс |
| Error rate | Sentry | > 1% |
| DB connections | Prometheus | > 180/200 |
| Redis memory | Prometheus | > 80% |
| Push delivery | Custom | > 3 сек |
| Disk space | Node exporter | > 85% |

---

## Grafana Dashboards

| Dashboard | Что показывает |
|-----------|---------------|
| API Overview | RPS, latency, errors |
| Database | Connections, queries, slow queries |
| Redis | Memory, hit rate, commands |
| Infrastructure | CPU, memory, disk, network |
| Business | Active users, pushes sent, signups |

---

## Sentry

| Клиент | DSN |
|--------|-----|
| Backend | `SENTRY_DSN` env var |
| Web | `NEXT_PUBLIC_SENTRY_DSN` env var |
| Mobile | `sentryDsn` в конфиге |

---

## Логирование

- Структурированные логи (JSON)
- Уровни: error, warn, info, debug
- Без лишних ПДн (нет паролей, токенов в логах)
- Централизация: Loki + Grafana

---

## См. также

- [ops/cicd.md](cicd.md) — pipeline
- [ops/runbooks.md](runbooks.md) — runbook'и
