# Source card: `apps/backend/src/migrations/1700000000011-PersonalLessonNotes.ts`

## Canonical source

`apps/backend/src/migrations/1700000000011-PersonalLessonNotes.ts`

## Scope

Creates tenant-owned personal lesson notes with foreign keys, cascade cleanup, and uniqueness per user and Pair Space.

## Read sequence

1. Read [the Pair Space module](../../../modules/pair-space.md).
2. Compare the migration with `PersonalLessonNote` and database migration configuration.

## Change boundary

Keep rollback symmetric with creation and preserve the uniqueness constraint needed for atomic upsert.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
