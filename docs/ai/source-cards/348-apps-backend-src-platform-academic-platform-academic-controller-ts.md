# Source card: Platform academic controller

## Canonical source

`apps/backend/src/platform-academic/platform-academic.controller.ts`

## Scope

Exposes authenticated global occurrence search, detail/history, and correction routes.

## Change boundary

Pass IP and user-agent for audit and leave ordinary academic routes unchanged.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
