# Source card: Platform homework controller

## Canonical source

`apps/backend/src/platform-homework/platform-homework.controller.ts`

## Scope

Defines the global homework submission search, detail, and correction routes under `/platform-homework/submissions`.

## Change boundary

The controller requires an authenticated request and delegates permission checks, domain validation, and audit writes to the service.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
