# Threat model and implemented controls

**Repository review: 2026-09-29.** This is an implementation-oriented checklist, not a completed security assessment or legal certification. Deployment controls must be verified on the target host.

## Implemented in source

| Threat area | Current control | Source of truth |
|---|---|---|
| Password disclosure | Account passwords are hashed with bcrypt | `apps/backend/src/auth/` |
| Forged/expired JWT | Passport JWT strategy validates signed tokens; token/session version checks are used where configured | `apps/backend/src/auth/` |
| Role escalation | `RolesGuard` and controller role metadata restrict role-specific routes | `apps/backend/src/common/guards/roles.guard.ts` |
| Cross-university/resource access | University context and resource checks in guards/services | `apps/backend/src/common/tenant/`, domain services |
| Request abuse | Global Nest throttler uses configured request window/limit | `apps/backend/src/app.module.ts`, `apps/backend/src/config/configuration.ts` |
| MAX identity spoofing/replay | Backend validates MAX initData signature and freshness before account linking | `apps/backend/src/auth/max-init-data.ts` |
| Moodle token disclosure | Connector tokens are encrypted using AES-256-GCM when `CONNECTOR_ENCRYPTION_KEY` is configured | `apps/backend/src/moodle/` |
| Migration/schema drift | TypeORM migrations are the schema source; production startup runs pending migrations | `apps/backend/src/migrations/`, `apps/backend/src/app.module.ts` |

## Controls that are not provided by this repository

- PostgreSQL Row Level Security is enabled and forced for tables that carry `universityId`/`university_id` (`1700000000029-TenantRowSecurity`), using the context set by `TenantDatabase`. It only works when the database role is `NOSUPERUSER NOBYPASSRLS`, so tenant isolation still requires the application-level checks and endpoint-level authorization review.
- Redis and BullMQ are wired for notification outbox delivery; external delivery channels stay disabled until their flags and credentials are configured and verified. Absence of flags is not evidence that a message was delivered.
- S3 file adapter, client-side Sentry, PostHog, Grafana, WAF/CDN, and Kubernetes controls are not configured here.
- Production TLS certificates, host firewall, SSH policy, database backup encryption/retention, monitoring alerts, and disaster recovery are operator responsibilities and have not been verified by this repository review.
- `docs/legal/` contains policy/terms templates with unfilled operator/date fields. Do not publish them until the service owner/legal reviewer completes them.

## Review checklist for changes

1. Identify the authenticated principal, tenant and resource scope at every new endpoint.
2. Add both allowed and denied tests for changes to authorization boundaries.
3. Validate and bound external input; avoid logging credentials, tokens or sensitive absence details.
4. Keep secrets in runtime secret storage/environment, never source control.
5. Review migration `up` and `down`, backup/rollback requirements, and production startup behavior.
6. Verify TLS, health, container exposure, logs and backups in the target environment before claiming release readiness.

## Related documents

- [Role boundaries](../architecture/roles-and-permissions.md)
- [152-FZ implementation notes](152-fz.md)
- [Deployment runbook](../deployment/production.md)
