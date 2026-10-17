# Source card: `apps/backend/src/platform-records/platform-records.service.ts`

## Canonical source

`apps/backend/src/platform-records/platform-records.service.ts`

## Scope

Global user search, personal record reads and writes, relationship checks, and transactional audit.

## Change boundary

Keep platform read/write permissions distinct, scope every record to its owner and university/resource, and avoid exposing credentials or notification content.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
