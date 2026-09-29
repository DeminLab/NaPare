# Source card: `apps/backend/src/migrations/1700000000014-HomeworkProgress.ts`

## Canonical source

`apps/backend/src/migrations/1700000000014-HomeworkProgress.ts`

## Scope

Creates per-student preparation progress and a JSONB personal checklist with unique ownership, cascade cleanup and constrained state values.

## Read sequence

1. Read the matching `HomeworkProgress` entity.
2. Check migration ordering and the migration runner configuration.

## Change boundary

Preserve one row per homework and student; never merge this table with Moodle submission records.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
