# Source card: `apps/backend/src/platform-data/platform-data.module.ts`

## Canonical source

`apps/backend/src/platform-data/platform-data.module.ts`

## Scope

Dependency registration for the platform student-data API, including absence-confirmation decisions.

## Change boundary

Register only the repositories and services required by absence, attendance, decision, and audit operations.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
