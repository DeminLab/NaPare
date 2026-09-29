# Source card: `apps/backend/src/favorites/favorites.service.ts`

## Canonical source

`apps/backend/src/favorites/favorites.service.ts`

## Scope

Tenant/account scoped listing, idempotent persistence, normalization, and deletion of student favorite references.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md).
2. Follow caller authorization in `favorites.controller.ts` and the database constraint in the migration.

## Change boundary

Never accept an owner or university ID from the request body. Preserve idempotent add behavior and case-insensitive teacher keys.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
