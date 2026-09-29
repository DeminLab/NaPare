# Source card: `apps/backend/src/pair-space/entities/personal-lesson-note.entity.ts`

## Canonical source

`apps/backend/src/pair-space/entities/personal-lesson-note.entity.ts`

## Scope

Tenant-scoped personal notes keyed by Pair Space and user. A unique pair-space/user index prevents duplicate notes; each note cascades with its university, Pair Space, or user.

## Read sequence

1. Read [the Pair Space module](../../../modules/pair-space.md).
2. Follow the entity to `PairSpaceService.getPersonalNote` and `savePersonalNote` and the `PersonalLessonNotes` migration.

## Change boundary

Keep personal content owner-scoped in every query and preserve the unique `(pairSpaceId, userId)` key.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/pair-space/pair-space.service.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```
