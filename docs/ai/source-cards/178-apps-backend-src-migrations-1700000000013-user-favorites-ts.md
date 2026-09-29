# Source card: `apps/backend/src/migrations/1700000000013-UserFavorites.ts`

## Canonical source

`apps/backend/src/migrations/1700000000013-UserFavorites.ts`

## Scope

Creates the tenant/account scoped favorite table, allowed-kind constraint, unique item key, lookup index, and cascading owner/tenant foreign keys.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md).
2. Compare the schema with `favorites/entities/favorite.entity.ts`.

## Change boundary

Keep migration order after `1700000000012-AttendanceQrSessions.ts` and make `down` reverse the schema changes.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
