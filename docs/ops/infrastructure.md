# Infrastructure

## Текущая конфигурация

Исходники deployment configuration — Compose manifests, Nginx configuration/templates и root [DEPLOY.md](../../DEPLOY.md). Это описание относится к конфигурации репозитория; состояние живого сервера надо проверять на самом сервере.

| Область | Источник правды |
| --- | --- |
| Local dependencies | [docker-compose.dev.yml](../../docker-compose.dev.yml) |
| Production services and commands | [docker-compose.prod.yml](../../docker-compose.prod.yml), [docker-compose.yml](../../docker-compose.yml), [DEPLOY.md](../../DEPLOY.md) |
| Application/system Nginx | [`infrastructure/nginx/nginx.conf`](../../infrastructure/nginx/nginx.conf), [host templates](../../deploy/nginx/README.md) |
| CI build and staging rollout | [CI/CD guide](cicd.md), `.github/workflows/` |

The repository does not contain an active Kubernetes or Terraform deployment. Cloud resource names, cluster sizes, S3 buckets, monitoring endpoints and secrets in the former version of this document were examples without checked-in provisioned infrastructure; they are intentionally not repeated as facts.

## Boundaries

- Compose health checks prove container-level status only.
- Docker Nginx may bind to loopback; external access also depends on host Nginx, DNS, firewall and TLS.
- Production database/Redis ports should not be exposed publicly. Confirm actual bindings in Compose before rollout.
- Never use `docker compose down -v` on a server with persistent data.

See [monitoring](monitoring.md) for current signals and [runbooks](runbooks.md) for repository-backed diagnostics.
