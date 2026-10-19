# Source card: Platform academic event controller

## Canonical source

`apps/backend/src/platform-academic/platform-academic-events.controller.ts`

## Scope

Exposes global search, detail, correction, hide, and restore routes for academic events.

## Change boundary

Keep authorization checks in the service and preserve the ordinary academic event response contract.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
