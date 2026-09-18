# Deployment Guide

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

`docker-compose.prod.yml` runs nginx, the backend, `web-student`, `web-staff`, `web-admin`, `web-developer`, PostgreSQL and Redis. PostgreSQL and Redis have no host ports in this topology.

Create a private `.env` file on the deployment host from the tracked template. Never commit the filled file:

```bash
cp .env.example .env
# Edit .env and replace all replace-with-* values and your public CORS origin.
```

The root `docker-compose.yml` includes the production stack, so the following commands can be run directly from the repository root:

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

Required values include database credentials, `REDIS_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET` and `CORS_ORIGIN`. Do not use development defaults in a production environment.

## Production promotion

There is no automatic production deployment. A future production workflow must be manually dispatched and protected with GitHub Environment reviewers, a completed staging verification and a documented rollback plan.
