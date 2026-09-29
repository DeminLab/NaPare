# Source card: `apps/web-student/src/app/(student)/pair-space/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/pair-space/page.tsx`

## Scope

Student entry point to Pair Spaces and the cross-lesson preparation/deadline overview.

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
