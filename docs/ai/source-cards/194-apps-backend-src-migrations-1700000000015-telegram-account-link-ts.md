# Source card: `apps/backend/src/migrations/1700000000015-TelegramAccountLink.ts`

## Canonical source

`apps/backend/src/migrations/1700000000015-TelegramAccountLink.ts`

## Scope

Adds a unique Telegram identity to users and the persistent one-time challenge table used by the Telegram webhook.

## Read sequence

1. Read [the Auth module](../../modules/auth.md) and [Telegram integration guide](../../clients/telegram-bot.md).
2. Read this migration and `TelegramLinkChallenge`.

## Change boundary

Keep the migration reversible and maintain the unique constraints that prevent duplicate Telegram links and challenge tokens.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
