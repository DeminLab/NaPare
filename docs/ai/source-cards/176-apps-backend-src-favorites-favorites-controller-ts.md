# Source card: `apps/backend/src/favorites/favorites.controller.ts`

## Canonical source

`apps/backend/src/favorites/favorites.controller.ts`

## Scope

Authenticated student-only API to list, save, and remove the current account's favorites.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md).
2. Follow the role guard and request-derived identity into `favorites.service.ts`.

## Change boundary

Keep owner and tenant IDs server-derived from the JWT; do not expose another user's favorite collection.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
