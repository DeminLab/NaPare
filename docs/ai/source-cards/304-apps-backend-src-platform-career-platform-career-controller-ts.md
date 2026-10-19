# Source card: Platform career controller

## Canonical source

`apps/backend/src/platform-career/platform-career.controller.ts`

## Scope

Developer routes for searching, reading and correcting university-bound career records within delegated university scope, plus owner/global-only company catalog and company membership management. Scoped university-center membership operations require an explicit in-scope university; application and work operations are governed by the operations service.

## Change boundary

The service enforces platform permissions, tenant scope, student/university linkage, domain transitions, consent and audit writes. Private detail reads receive request IP and user-agent for audit context.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
