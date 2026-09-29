# Source card: `apps/backend/src/migrations/1700000000016-TelegramNotifications.ts`

## Canonical source

`apps/backend/src/migrations/1700000000016-TelegramNotifications.ts`

## Scope

Adds the opt-in Telegram notification preference, disabled by default.

## Read sequence

1. Read [the Notifications module](../../modules/notifications.md).
2. Follow the preference entity and update DTO.

## Change boundary

Keep the default false and preserve reversible migration behavior.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
