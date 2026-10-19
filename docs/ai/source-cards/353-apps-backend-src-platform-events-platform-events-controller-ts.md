# Source card: Platform events controller

## Canonical source

`apps/backend/src/platform-events/platform-events.controller.ts`

## Scope

Exposes authenticated search and detail routes for platform system events.

## Change boundary

Keep routes read-only and pass request context to the service for audit records.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
