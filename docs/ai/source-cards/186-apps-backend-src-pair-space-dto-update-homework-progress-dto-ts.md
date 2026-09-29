# Source card: `apps/backend/src/pair-space/dto/update-homework-progress.dto.ts`

## Canonical source

`apps/backend/src/pair-space/dto/update-homework-progress.dto.ts`

## Scope

Validates personal preparation state changes and bounded checklist updates.

## Read sequence

1. Read the `HomeworkProgress` state union.
2. Read the role and lesson-scope checks in `PairSpaceService.updateHomeworkProgress`.

## Change boundary

Allow only the declared personal progress values; do not add submission fields here.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
