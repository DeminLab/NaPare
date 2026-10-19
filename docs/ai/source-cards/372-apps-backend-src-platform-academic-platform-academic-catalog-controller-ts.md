# Source card: Platform academic catalog controller

## Canonical source

`apps/backend/src/platform-academic/platform-academic-catalog.controller.ts`

## Scope

Exposes global catalog search, detail, university-scoped selector options, and correction routes for courses and series.

## Change boundary

Preserve service-level permission checks and existing academic API contracts.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
