# Source card: `apps/web-student/src/app/(student)/settings/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/settings/page.tsx`

## Scope

Settings with URL section state, real notification preferences grouped into schedule, preparation/conversation and system/delivery. Dirty save state is visible; security explains administrator-managed passwords. One workspace main landmark is retained.

## Read sequence

1. Read [the Notifications module](../../modules/notifications.md).
2. Read this route and `apps/web-student/src/lib/api.ts`.
3. Follow preference fields to `NotificationsController`, `NotificationsService`, and `NotificationPreference`.

## Change boundary

Keep event preference field names aligned with the backend DTO and `NotificationsService.isAllowed`. Keep profile edits on the authenticated account API and do not claim a local-only setting changes server notification delivery.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
