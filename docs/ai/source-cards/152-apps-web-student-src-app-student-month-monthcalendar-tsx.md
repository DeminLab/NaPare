# Source card: `apps/web-student/src/app/(student)/month/MonthCalendar.tsx`

## Canonical source

`apps/web-student/src/app/(student)/month/MonthCalendar.tsx`

## Scope

Responsive student month calendar, including daily lesson chips with available building/room/subgroup/week-parity context and Pair Space links for persisted lesson IDs.

## Read sequence

1. Read the [month route source card](148-apps-web-student-src-app-student-month-page-tsx.md).
2. Read this component and `../schedule-location.ts`.

## Change boundary

Keep desktop and mobile date semantics aligned, and display location only when the source supplied it.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
