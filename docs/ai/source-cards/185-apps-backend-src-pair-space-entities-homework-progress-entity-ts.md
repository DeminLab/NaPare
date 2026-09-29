# Source card: `apps/backend/src/pair-space/entities/homework-progress.entity.ts`

## Canonical source

`apps/backend/src/pair-space/entities/homework-progress.entity.ts`

## Scope

Stores each student's private status and up to 20 checklist steps independently from the teacher's publication and any LMS submission.

## Read sequence

1. Read the migration `1700000000014-HomeworkProgress.ts`.
2. Follow serialization from `PairSpaceService.listPreparationsForLessons`.

## Change boundary

Do not treat this state as a Moodle submission or shared completion flag.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
