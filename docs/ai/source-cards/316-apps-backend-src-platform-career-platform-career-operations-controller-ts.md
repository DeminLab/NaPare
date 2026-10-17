# Source card: Platform career operations controller

## Canonical source

`apps/backend/src/platform-career/platform-career-operations.controller.ts`

## Scope

Global career application and work search, detail, correction, candidate selection, and review routes.

## Change boundary

The controller passes request audit metadata. Domain transitions and permission checks stay in the service.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
