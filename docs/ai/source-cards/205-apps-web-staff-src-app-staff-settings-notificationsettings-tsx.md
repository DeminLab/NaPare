# Source card: `apps/web-staff/src/app/(staff)/settings/NotificationSettings.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/settings/NotificationSettings.tsx`

## Scope

Existing notification preferences GET/PATCH UI: event categories, explicit save, retained choices on error and Telegram availability from account status. Quiet-hour preferences are preserved rather than overwritten.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve existing API contracts, role access and base paths. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```
