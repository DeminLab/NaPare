# Source card: `apps/web-student/src/app/(student)/PreparationProgressControl.tsx`

## Canonical source

`apps/web-student/src/app/(student)/PreparationProgressControl.tsx`

## Scope

Lets a student track a published preparation item as planned, in progress or done using an account-scoped offline queue and the authenticated API. The separate checklist component manages personal steps.

## Read sequence

1. Read its use on the Student Today screen.
2. Read `preparation-progress-api.ts` for reconnect synchronization.

## Change boundary

Label the state as personal preparation progress; never imply that it was submitted or graded.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
