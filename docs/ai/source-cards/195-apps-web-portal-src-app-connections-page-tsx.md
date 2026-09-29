# Source card: `apps/web-portal/src/app/connections/page.tsx`

## Canonical source

`apps/web-portal/src/app/connections/page.tsx`

## Scope

Authenticated account connections page. MAX status is loaded from `/auth/max/status` and linking uses fresh Bridge `initData` with `/auth/max/link`; Telegram uses its short-lived backend-issued deep link. Credentials and MAX identity values are not displayed.

## Read sequence

1. Read [Telegram integration guide](../../clients/telegram-bot.md) and [MAX client guide](../../clients/max-miniapp.md).
2. Read this page and the `GET /auth/max/status`, `POST /auth/max/link`, and `POST /auth/telegram/link` API contracts.

## Change boundary

Only the backend verifies and commits MAX/Telegram links. The current user must be authenticated, MAX linking must use fresh launch data from inside MAX, and link status must expose only a boolean. Do not put passwords or raw platform identity values in the page or browser storage.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
