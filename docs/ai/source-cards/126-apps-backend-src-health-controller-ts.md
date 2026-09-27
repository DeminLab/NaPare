# Source card: `apps/backend/src/health.controller.ts`

## Canonical source

`apps/backend/src/health.controller.ts`

## Scope

Unauthenticated liveness and readiness endpoint for Docker health checks and the developer workspace. It verifies a simple database query before reporting the API as healthy.

## Change boundary

Keep this endpoint free of credentials and private data. A database failure must return an HTTP 503 so orchestration and monitoring do not mistake a process-only response for a ready service.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/health.controller.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```
