# Source card: Platform career operations controller

## Canonical source

`apps/backend/src/platform-career/platform-career-operations.controller.ts`

## Scope

Career application and work search, detail, correction, candidate selection, and review routes. Service-level university grant scope limits the accessible records.

## Change boundary

The controller passes request audit metadata. Domain transitions and permission checks stay in the service.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
