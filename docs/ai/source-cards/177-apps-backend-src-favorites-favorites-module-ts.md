# Source card: `apps/backend/src/favorites/favorites.module.ts`

## Canonical source

`apps/backend/src/favorites/favorites.module.ts`

## Scope

Nest module wiring the favorites entity, service, and controller.

## Read sequence

1. Read `favorites.controller.ts` and `favorites.service.ts`.
2. Follow registration in `app.module.ts` and `database.module.ts`.

## Change boundary

Keep the module's entity registration aligned with the migration.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
