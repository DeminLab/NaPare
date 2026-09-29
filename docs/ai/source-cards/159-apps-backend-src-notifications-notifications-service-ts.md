# Source card: `apps/backend/src/notifications/notifications.service.ts`

## Canonical source

`apps/backend/src/notifications/notifications.service.ts`

## Scope

Notification preferences, in-app notifications and inbox fan-out. Optional Telegram delivery is opt-in, follows the same category/quiet-hour filters, and uses validated internal deep links. Schedule events include backend-supplied old/new details; cancellation notices include the original lesson's time and location.

## Read sequence

1. Read [the Notifications module](../../modules/notifications.md) and the [Schedule module](../../modules/schedule.md).
2. Follow `NotificationEventHandler` recipient resolution and `mapEvent` formatting.

## Change boundary

Do not infer schedule changes from display text; format only the signed-off event payload. Preserve recipient and tenant scoping and internal-link validation.

## Verification

```powershell
pnpm --filter @napare/backend exec jest --runInBand src/notifications/notifications.service.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```
