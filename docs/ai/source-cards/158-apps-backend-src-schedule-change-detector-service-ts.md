# Source card: `apps/backend/src/schedule/change-detector.service.ts`

## Canonical source

`apps/backend/src/schedule/change-detector.service.ts`

## Scope

Compares imported lessons with persisted schedule entries across date, time, location, teacher, subject, lesson type, subgroup, and week parity. Stores field-level old/new values with a readable before/after summary, updates the lesson, and publishes a tenant-scoped change event for notification delivery.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md) and [the Notifications module](../../modules/notifications.md).
2. Follow the emitted event to `NotificationsService.processEvent` and its schedule change formatter.

## Change boundary

Keep event values sourced from the detected diff. Link the event to the changed lesson's Pair Space and include group/teacher recipients. Keep the summary human-readable and preserve raw values in `oldValues`/`newValues`.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/backend exec eslint src/schedule/change-detector.service.ts
```
