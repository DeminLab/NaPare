# Source card: `apps/web-student/src/app/(student)/pair-space/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/pair-space/page.tsx`

## Scope

Student preparation list preserves query and filter in the URL, requests my-day with the existing timeZone parameter, and links to the preparation tab of each lesson. Personal progress remains separate from submission.

## Read sequence

1. Read [the Pair Space module](../../modules/pair-space.md) and [the My Day module](../../modules/my-day.md).
2. Read this route and `apps/web-student/src/lib/api.ts`.
3. Follow the response to `MyDayService` and the role-scoped ScheduleService query.

## Change boundary

Do not invent assignment completion or submission status. Each reminder opens its lesson's Pair Space; actual submission and grading stay in Moodle.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
