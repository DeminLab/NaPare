# Source card: Platform legacy academic DTOs

## Canonical source

`apps/backend/src/platform-academic/platform-academic-legacy.dto.ts`

## Scope

Validates global legacy lesson search filters and reasoned correction fields.

## Change boundary

Keep date, time, string length, and pagination constraints aligned with the service allowlist.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
