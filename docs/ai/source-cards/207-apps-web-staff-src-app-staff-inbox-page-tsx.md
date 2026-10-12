# Source card: `apps/web-staff/src/app/(staff)/inbox/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/inbox/page.tsx`

## Scope

Staff attention centre with URL-restored open/snoozed/done filters and the existing task completion endpoint. Marking a task handled does not approve a student absence request. Obsolete reads are aborted.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve existing API contracts, role access and base paths. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```
