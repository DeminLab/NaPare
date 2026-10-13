# Source card: `apps/web-student/src/app/(student)/profile/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/profile/page.tsx`

## Scope

Student identity/contact profile with separate study/activity sections. Repeated study and activity blocks are removed from the primary tab. Editing/security links lead to supported settings; no fictitious phone or attendance metric is shown.

## Read sequence

1. Read [the My Day module](../../modules/my-day.md).
2. Read this route and `apps/web-student/src/lib/api.ts`.
3. Follow preparation aggregation to `MyDayService`.

## Change boundary

Report preparation reminders, not submission or completion counts. Submission and grading remain in Moodle.

Недоступные уведомления обозначены отдельно от пустой истории; число относится к загруженному списку.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
