# Source card: `apps/web-student/src/app/(student)/settings/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/settings/page.tsx`

## Scope

Student account settings. Notification delivery preferences, opt-in Telegram delivery after account linking, quiet hours, and the device's IANA time zone are loaded from and saved through the authenticated `/notifications/preferences` API. Name, surname, and phone are saved through authenticated `PATCH /users/me`; light/dark/system theme, accent color, and compact mode are saved locally and applied across the student workspace by the route group's `StudentAppearanceProvider`.

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
