# Source card: `apps/backend/src/auth/telegram-webhook.controller.ts`

## Canonical source

`apps/backend/src/auth/telegram-webhook.controller.ts`

## Scope

Validates Telegram's webhook secret header with a timing-safe comparison before forwarding updates to the account-linking service.

## Read sequence

1. Read [the Auth module](../../modules/auth.md) and [Telegram integration guide](../../clients/telegram-bot.md).
2. Read this controller and `apps/backend/src/auth/auth.service.ts`.
3. Follow one-time challenge storage in `apps/backend/src/users/users.service.ts`.

## Change boundary

Never process updates without the configured webhook secret. User linking is restricted to `/start` or `/link` in a private chat.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
