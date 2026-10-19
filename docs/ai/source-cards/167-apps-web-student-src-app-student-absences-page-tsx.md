# Source card: `apps/web-student/src/app/(student)/absences/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/absences/page.tsx`

## Scope

Student absence requests and factual attendance are separated views with URL filters. Request totals do not claim attendance percentages. The current student contract has no teacher-mark history; the attendance view explains this and links to QR and schedule. The route loads all pages from the existing student-scoped history endpoint. A date filter matches any calendar date inside a multi-day absence interval. Desktop and mobile history rows show the full localized period, collapse same-day periods to one date, and fall back to start date or legacy `date` when `endDate` is missing. The affected-lesson summary shows an unknown value when the API does not supply enough data, including a database-default zero count with no lesson IDs, and stacks into one column on narrow screens.

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
