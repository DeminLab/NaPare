# Source card: Platform legacy academic controller

## Canonical source

`apps/backend/src/platform-academic/platform-academic-legacy.controller.ts`

## Scope

Exposes global list, detail, and patch routes for legacy lessons without a linked occurrence.

## Change boundary

Preserve the `academic-data.read/write` service checks and existing schedule routes.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
