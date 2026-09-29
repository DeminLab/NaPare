# Source card: `apps/backend/src/notifications/homework-deadline-reminder.service.ts`

## Canonical source

`apps/backend/src/notifications/homework-deadline-reminder.service.ts`

## Scope

Scans active Pair Space assignments every 15 minutes and publishes one idempotent `homework.deadline_soon` event per assignment deadline in the next 24 hours. Events include the lesson group and teacher for notification recipient resolution.

## Read sequence

1. Read [the Notifications module](../../modules/notifications.md).
2. Read this service and `notifications.module.ts`.
3. Follow event delivery through `EventBusService` and `NotificationEventHandler`.

## Change boundary

Keep reminder event keys stable across runs, verify the lesson belongs to the same university as its Pair Space, and preserve notification preference and quiet-hour filtering downstream.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/notifications/homework-deadline-reminder.service.spec.ts --runInBand --forceExit
```
