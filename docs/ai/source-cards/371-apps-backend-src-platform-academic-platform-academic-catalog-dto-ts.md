# Source card: Platform academic catalog DTOs

## Canonical source

`apps/backend/src/platform-academic/platform-academic-catalog.dto.ts`

## Scope

Validates global course and series search, safe university options, and reasoned correction fields.

## Change boundary

Keep provenance and identity fields outside write DTOs, and retain date, time, and relationship constraints.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
