# Source card: `apps/web-student/src/app/(student)/month/MonthCalendar.tsx`

## Canonical source

`apps/web-student/src/app/(student)/month/MonthCalendar.tsx`

## Scope

Compact month selector on desktop and mobile. The parent owns the selected date and URL state; selecting a day reveals every lesson in a readable adjacent/below panel. Lesson dots and text badges share type colors, while accessible day labels announce localized lesson types. Location/subgroup/week parity come from the source, and Pair Space links are restricted to persisted lesson IDs.

Selected-day subject names wrap rather than truncate. `lessonCountLabel` supplies Russian count labels for the month summary and selected day.

## Read sequence

1. Read the [month route source card](148-apps-web-student-src-app-student-month-page-tsx.md).
2. Read this component and `../schedule-location.ts`.

## Change boundary

Keep desktop and mobile date semantics aligned, and display location only when the source supplied it.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
