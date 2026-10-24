# Source card: `apps/backend/src/notifications/notifications.service.ts`

## Canonical source

`apps/backend/src/notifications/notifications.service.ts`

## Scope

Event notifications and inbox items retain existing schemas and scopes. Preparation reminders use preparation wording and explain that submissions and grades remain in Moodle, avoiding false submission instructions to teachers.

Notification creation delegates to the transactional PostgreSQL outbox when the delivery service is installed. Legacy tokens remain inert; WebPush/RuStore registration validates the provider-specific token. See [notification delivery](../../integrations/notification-delivery.md).

Legacy token updates whitelist registration fields instead of saving a stale entity. They cannot restore WebPush consent revoked by concurrent logout; explicit consent belongs to the dedicated self API. Preserve this separation and the HTTP/PostgreSQL race regression.

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
