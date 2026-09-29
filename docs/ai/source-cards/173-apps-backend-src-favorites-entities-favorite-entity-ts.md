# Source card: `apps/backend/src/favorites/entities/favorite.entity.ts`

## Canonical source

`apps/backend/src/favorites/entities/favorite.entity.ts`

## Scope

Account and university scoped saved references for a student's favorite external groups and teacher names. External references are not local schedule UUIDs.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md).
2. Follow the entity's unique tenant/account/kind/reference index and its migration.

## Change boundary

Keep favorite records private to their owner and university. `group` and `teacher` are the only supported kinds.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
