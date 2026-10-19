# Source card: `apps/web-student/src/app/(student)/settings/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/settings/page.tsx`

## Scope

Settings with URL section state, real notification preferences grouped into schedule, preparation/conversation and system/delivery. Dirty save state is visible; security explains administrator-managed passwords. One workspace main landmark is retained.

The October 16 revision shows the save bar only for real edits in the current section; profile and appearance dirty states are separate. Loading preferences preserves the server timezone instead of silently substituting the device zone and triggering a false unsaved-changes warning. Quiet-hours settings offer an explicit action to use the device timezone. The sidebar and section headings omit generic descriptions.
Unsaved profile, appearance and notification changes stay visible when the user switches sections. A persistent save bar exposes one save action per dirty area, and desktop section buttons announce their pressed state.

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
