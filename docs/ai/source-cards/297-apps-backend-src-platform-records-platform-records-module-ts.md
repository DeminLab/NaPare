# Source card: `apps/backend/src/platform-records/platform-records.module.ts`

## Canonical source

`apps/backend/src/platform-records/platform-records.module.ts`

## Scope

Dependency registration for the personal-record management API.

## Change boundary

Register only entities needed by its explicit domain operations.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
