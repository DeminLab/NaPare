# Source card: Platform academic module

## Canonical source

`apps/backend/src/platform-academic/platform-academic.module.ts`

## Scope

Registers global management for normalized occurrences, legacy lessons, and academic events, with series, course, group, university, user, history, audit, and event services.

## Change boundary

Preserve tenant/resource relationship checks and the existing academic API contracts.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
