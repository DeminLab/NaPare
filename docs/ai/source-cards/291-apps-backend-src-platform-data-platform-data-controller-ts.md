# Source card: `apps/backend/src/platform-data/platform-data.controller.ts`

## Canonical source

`apps/backend/src/platform-data/platform-data.controller.ts`

## Scope

Global search and controlled changes to student absences and attendance through platform permissions.

## Change boundary

Keep server-side permission and tenant/resource checks authoritative. Require a reason and preserve audit history for mutations.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
