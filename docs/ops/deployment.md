# Deployment Guide

The current production topology and the operator runbook are maintained in the repository root: [DEPLOY.md](../../DEPLOY.md). It covers the four frontend subdomains, the apex site, Cockpit under `/admin/`, system Nginx templates, DNS and TLS boundaries.

## Current delivery flow

1. A pull request to `main` runs the `CI` workflow: lint, typecheck, unit coverage, backend E2E, production build and dependency audit.
2. A successful push to `main` triggers `Build images and deploy staging`.
3. That workflow builds commit-SHA-tagged images in GHCR for the backend and all four web applications.
4. The protected GitHub `staging` Environment supplies connection secrets and executes the deployment command on the staging host.
5. The workflow checks `GET /api/v1/health` after deployment.

See [CI/CD](cicd.md) for the exact required GitHub Environment secrets.

## Local infrastructure

```powershell
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

The local Compose stack contains PostgreSQL, Redis and MinIO. Its published ports are for local development only.

## Production Compose

`docker-compose.prod.yml` runs nginx, the backend, `web-portal`, `web-student`, `web-staff`, `web-admin`, `web-developer`, PostgreSQL and Redis. PostgreSQL and Redis have no host ports, while Docker Nginx and the frontend ports bind to loopback only (`127.0.0.1:8080` and `127.0.0.1:3001`–`3005`). `web-portal` serves the shared main page and login; the student, staff and deanery workspaces are available at `/student/`, `/staff/` and `/deanery/` on the same origin. System Nginx templates in `deploy/nginx/` are configured separately on the host.

Create a private `.env` file on the deployment host from the tracked template. Never commit the filled file:

```bash
cp .env.example .env
# Edit .env and replace all replace-with-* values and your public CORS origin.
```

The root `docker-compose.yml` includes the production stack, so the following commands can be run directly from the repository root:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:8080/api/v1/health
```

Required values include database credentials, `REDIS_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET` and `CORS_ORIGIN`. The four `NEXT_PUBLIC_*_URL` values are public build-time configuration. Do not use development defaults in a production environment.

## Production promotion

There is no automatic production deployment. A future production workflow must be manually dispatched and protected with GitHub Environment reviewers, a completed staging verification and a documented rollback plan.
