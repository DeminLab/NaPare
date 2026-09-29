# Source card: `apps/web-portal/src/app/connections/page.tsx`

## Canonical source

`apps/web-portal/src/app/connections/page.tsx`

## Scope

Authenticated account connection page that asks the backend to create a short-lived Telegram deep link without handling or transmitting credentials.

## Read sequence

1. Read [Telegram integration guide](../../clients/telegram-bot.md) and [MAX client guide](../../clients/max-miniapp.md).
2. Read this page and the `POST /auth/telegram/link` API contract.

## Change boundary

Only the backend may issue link challenges. Do not put passwords or raw Telegram identity values in the page or browser storage.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
