# Source card: `apps/backend/src/favorites/dto/favorite.dto.ts`

## Canonical source

`apps/backend/src/favorites/dto/favorite.dto.ts`

## Scope

Validation for student favorite create/update and delete API payloads.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md).
2. Follow DTO use in `favorites.controller.ts` and normalization in `favorites.service.ts`.

## Change boundary

Allow only known favorite kinds and bounded identifiers/labels.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
