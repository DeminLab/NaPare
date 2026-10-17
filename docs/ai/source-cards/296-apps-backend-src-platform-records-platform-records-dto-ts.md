# Source card: `apps/backend/src/platform-records/platform-records.dto.ts`

## Canonical source

`apps/backend/src/platform-records/platform-records.dto.ts`

## Scope

Bounded personal-record search and validated notification, favorite, note, progress, and delete payloads.

## Change boundary

Require a reason for every write and validate each editable field explicitly.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
