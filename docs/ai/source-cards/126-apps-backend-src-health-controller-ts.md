# Source card: `apps/backend/src/health.controller.ts`

## Canonical source

`apps/backend/src/health.controller.ts`

## Scope

Unauthenticated readiness endpoint for Docker health checks and the developer workspace. It verifies a database query and an optional `HEALTH_QUEUE_PROBE`, with a three-second deadline per dependency. Without a registered queue it reports `not_configured`.

## Change boundary

Keep this endpoint free of credentials and private data. A database failure must return an HTTP 503 so orchestration and monitoring do not mistake a process-only response for a ready service.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/health.controller.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```
