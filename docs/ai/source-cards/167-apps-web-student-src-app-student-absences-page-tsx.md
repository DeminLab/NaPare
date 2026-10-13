# Source card: `apps/web-student/src/app/(student)/absences/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/absences/page.tsx`

## Scope

Student absence requests and factual attendance are separated views with URL filters. Request totals do not claim attendance percentages. The current student contract has no teacher-mark history; the attendance view explains this and links to QR and schedule.

## Read sequence

1. Read [the Absences module](../../modules/absences.md).
2. Read this page and the schedule range API.
3. Follow absence ownership and tenant scope to `AbsencesService`.

## Change boundary

Load a full timestamp range for lesson context so lessons later in each day are included. Keep data scoped to the current student's API response.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
