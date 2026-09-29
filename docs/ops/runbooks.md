# Runbooks

This file covers repository-backed Docker Compose checks. It does not describe production host access, DNS/TLS or provider dashboards; use the operator-specific instructions in root [DEPLOY.md](../../DEPLOY.md).

## Check deployment health

```bash
docker compose ps
docker compose logs --tail 100 backend
curl -fsS http://127.0.0.1:8080/api/v1/health
```

The public hostname and reverse proxy depend on server configuration. A successful loopback request verifies only the local Docker gateway.

## Backend does not become healthy

1. Inspect `docker compose ps` and `docker compose logs --tail 200 backend`.
2. Check PostgreSQL with `docker compose logs --tail 100 postgres` and verify the configured database credentials.
3. Check required production environment variables and `CORS_ORIGIN` on the host without copying secret values into tickets or logs.
4. Review TypeORM migration startup messages. Production backend applies pending migrations at startup; take a database backup before rollout.
5. If service-level checks pass but the public site fails, inspect host Nginx, DNS and TLS separately as described in `DEPLOY.md`.

## PostgreSQL capacity or restore

Use the database provider/host's supported backup and restore process. Do not run destructive cleanup SQL based on example table names; verify actual retention policy, table ownership and a restorable backup first. Database access is environment-specific and is not exposed as a public Compose port.

## Schedule source or Moodle connector issue

1. Inspect backend logs for the relevant connector and timestamp.
2. Confirm the upstream service is reachable from the deployment host.
3. Compare its current response with the adapter implementation and tests before changing mappings.
4. For Moodle, verify configured HTTPS URL and Web Services permissions. The connector's test call only checks site information; it does not synchronize course content.

## Not current operational runbooks

The repository does not configure SMS delivery, FCM/APNs push sending, Redis-backed queues/session storage, Grafana alerts or S3 file storage. Do not use old Firebase, Redis memory-cleanup, or SQL-retention instructions as production procedures. Their integration must be implemented and operated before adding a runbook.
