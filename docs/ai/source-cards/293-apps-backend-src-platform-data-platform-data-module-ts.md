# Source card: `apps/backend/src/platform-data/platform-data.module.ts`

## Canonical source

`apps/backend/src/platform-data/platform-data.module.ts`

## Scope

Dependency registration for the platform student-data API.

## Change boundary

Register only the repositories and services required by its domain operations.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
