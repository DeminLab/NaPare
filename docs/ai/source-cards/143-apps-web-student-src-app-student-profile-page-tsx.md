# Source card: `apps/web-student/src/app/(student)/profile/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/profile/page.tsx`

## Scope

Student profile and study summary, including preparation count from the role-scoped My Day response and a security-tab link to the shared Telegram account-connection page.

## Read sequence

1. Read [the My Day module](../../modules/my-day.md).
2. Read this route and `apps/web-student/src/lib/api.ts`.
3. Follow preparation aggregation to `MyDayService`.

## Change boundary

Report preparation reminders, not submission or completion counts. Submission and grading remain in Moodle.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
