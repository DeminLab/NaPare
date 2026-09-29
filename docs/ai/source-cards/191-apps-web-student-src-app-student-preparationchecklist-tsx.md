# Source card: `apps/web-student/src/app/(student)/PreparationChecklist.tsx`

## Canonical source

`apps/web-student/src/app/(student)/PreparationChecklist.tsx`

## Scope

Lets a student manage up to 20 personal checklist steps for a published preparation item and reports pending offline synchronization.

## Read sequence

1. Read its use in the Pair Space preparation tab.
2. Read `preparation-progress-api.ts` and the backend validation limits.

## Change boundary

Checklist steps are private student planning data; they are not uploaded work or a Moodle submission.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
