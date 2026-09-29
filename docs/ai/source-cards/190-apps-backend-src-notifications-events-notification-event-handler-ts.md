# Source card: `apps/backend/src/notifications/events/notification-event.handler.ts`

## Canonical source

`apps/backend/src/notifications/events/notification-event.handler.ts`

## Scope

Resolves tenant-scoped notification recipients and suppresses assignment deadline notifications for students who marked that preparation done, while preserving teacher reminders.

## Read sequence

1. Read `HomeworkDeadlineReminderService` for event payload and target.
2. Read `HomeworkProgress` and the role-scoped recipient selection.
3. Read `NotificationsService.processEvent` for per-recipient preferences and inbox creation.

## Change boundary

A personal preparation status suppresses reminders only for that student; it does not mark a Moodle submission or suppress reminders for the teacher or classmates.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
