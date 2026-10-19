# Source card: `apps/web-staff/src/app/(staff)/settings/NotificationSettings.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/settings/NotificationSettings.tsx`

## Scope

Server-backed notification preferences grouped into schedule, preparation/conversation and system. Telegram delivery is disabled globally and has no control here; its existing preference value is preserved when other settings are saved. Loading is announced as a busy status, and the save bar is sticky only while dirty.

## Read sequence

1. Read [the UX implementation plan](../../product/ux-improvement-plan.md).
2. Read the canonical source and its role callers before changing behaviour.

## Change boundary

Preserve existing API contracts, role access and base paths. Student/navigation/header changes require the approved UX scope. Avatar and logo assets remain protected.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```
