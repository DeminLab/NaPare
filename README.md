# NaPare

## What is NaPare

NaPare is a university learning-day platform. It brings schedules, PairSpace content, homework, absence tracking and notifications into role-specific web applications backed by one API.

## Product architecture

```text
web-student ─┐
web-staff ───┼──> NestJS API (/api/v1) ──> PostgreSQL
web-admin ───┤              │
web-developer┘              ├────────────> Redis
                             └────────────> S3-compatible file storage
```

The backend is a modular monolith. Auth, users, schedule, PairSpace, absences, notifications, admin and My Day are NestJS modules. Tenant-scoped data is associated with a university; the authenticated tenant context is used for authorization and data access.

## Repository structure

```text
apps/
  backend/          NestJS API and TypeORM migrations
  web-student/      Next.js application for students
  web-staff/        Next.js application for staff and curators
  web-admin/        Next.js university administration application
  web-developer/    Next.js developer console
packages/
  api-client/       TypeScript API client
  shared/           Shared types, constants and validators
infrastructure/     Docker and nginx configuration
docs/               Product, architecture, operational and security docs
```

## Applications

| Package | Purpose | Development URL |
| --- | --- | --- |
| `@napare/backend` | REST API, Swagger and migrations | `http://localhost:3000` |
| `@napare/web-student` | Student workspace | `http://localhost:3001` |
| `@napare/web-staff` | Staff and curator workspace | `http://localhost:3002` |
| `@napare/web-admin` | University administration | `http://localhost:3003` |
| `@napare/web-developer` | Developer console | `http://localhost:3004` |
| `@napare/api-client` | Shared TypeScript API client | — |
| `@napare/shared` | Shared domain types and constants | — |

## Tech stack

- Node.js 20, pnpm 9 and Turborepo 2
- NestJS 10, TypeORM and PostgreSQL 16
- Next.js 14 and React 18
- Redis 7 and S3-compatible object storage (MinIO in local development)
- Docker Compose, nginx and GitHub Actions

## Local development

Prerequisites: Node.js 20+, pnpm 9+, Docker Desktop with Docker Compose v2.

```powershell
pnpm install
Copy-Item apps/backend/.env.example apps/backend/.env
docker compose -f docker-compose.dev.yml up -d
pnpm dev
```

Run one application when needed:

```powershell
pnpm --filter @napare/backend dev
pnpm dev:student
pnpm dev:staff
pnpm dev:admin
pnpm dev:developer
```

The development Compose file exposes PostgreSQL on `5432`, Redis on `6379`, and MinIO on `9000`/`9001` for local use only.

## Environment variables

Copy `apps/backend/.env.example` to `apps/backend/.env`. Never commit a populated environment file.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development`, `test` or `production` |
| `PORT` | No | API port; defaults to `3000` |
| `DATABASE_URL` | No | Full PostgreSQL connection URL; use instead of individual DB fields |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | When `DATABASE_URL` is absent | PostgreSQL connection fields |
| `JWT_SECRET` | Yes | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh-token signing secret |
| `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION` | Yes | JWT lifetimes, for example `15m` and `30d` |
| `REDIS_HOST`, `REDIS_PORT` or `REDIS_URL` | Deployment-dependent | Redis connection |
| `CORS_ORIGIN` | Production | Allowed web origin |
| `SENTRY_DSN` | No | Sentry DSN |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_USE_SSL` | For file storage | S3-compatible storage configuration |

Production Compose additionally requires `REDIS_PASSWORD`; it refuses to start when required database, Redis, JWT or CORS values are missing.

## Database

PostgreSQL is the system of record. TypeORM entities and migrations live in `apps/backend/src`; migrations are run with the backend package:

```powershell
pnpm --filter @napare/backend typeorm:migration:run
pnpm --filter @napare/backend typeorm:migration:revert
```

For local development, start the Compose services before the API. Do not use `synchronize` or development credentials in production.

## API

The API base path is `/api/v1`. Swagger is available at `http://localhost:3000/api/v1/docs` while the backend is running. Controllers validate request DTOs and use JWT authentication and role/tenant guards where required.

## Testing

```powershell
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:e2e
pnpm build
pnpm security:audit
```

E2E tests require PostgreSQL and Redis. GitHub Actions provides isolated service containers; local runs should use a dedicated test database rather than a shared development database.

## Docker

Use `docker-compose.dev.yml` for local infrastructure. `docker-compose.prod.yml` runs the production topology: nginx, backend, four web applications, PostgreSQL and Redis. PostgreSQL and Redis are internal-only in the production network.

Validate a production Compose configuration after supplying a secure external environment file:

```powershell
docker compose --env-file <secure-env-file> -f docker-compose.prod.yml config
```

## Deployment

The `CI` GitHub Actions workflow runs lint, typecheck, unit tests with coverage, backend E2E tests, production builds and a production dependency audit for pull requests and pushes to `main`.

After a successful push to `main`, the staging workflow builds immutable GHCR images tagged with the commit SHA, deploys through the protected `staging` GitHub Environment, then checks `/api/v1/health`. Staging connection details are GitHub Environment secrets. No production deployment runs automatically; production promotion must be a separate reviewer-gated manual flow.

## Security

- JWT access and refresh secrets are validated at startup; no fallback signing secrets are used.
- Authentication roles are typed and tenant-scoped requests are checked against university access.
- Do not place credentials in source files, Docker Compose defaults for production, or GitHub Actions YAML.
- Run `pnpm security:audit` before merging dependency changes.

## Documentation

- [Documentation entry point](docs/00_START_HERE.md)
- [Architecture](docs/architecture/README.md)
- [API contracts](docs/api/README.md)
- [CI/CD and branch protection](docs/ops/cicd.md)
- [Security notes](docs/security/threat-model.md)

## Contributing

Read [the contribution guide](docs/process/contributing.md), keep changes scoped to a module, and run the relevant lint, typecheck and test commands before opening a pull request. `main` should be protected by required CI checks and review.
