# Source card: `apps/web-portal/src/app/connections/page.tsx`

## Canonical source

`apps/web-portal/src/app/connections/page.tsx`

## Scope

Shared account connections page has responsive semantic CSS, MAX instructions, initial and focus status checks, login states, and temporary link creation through existing authenticated APIs. Status requests use sequence invalidation so delayed results cannot overwrite a successful link mutation; starting a link also invalidates pending status responses. A successful link immediately marks its status known and linked. Actual messenger delivery requires configured integrations.

## Read sequence

1. Read [MAX client guide](../../clients/max-miniapp.md). Telegram is disabled by owner decision.
2. Read this page and the `GET /auth/max/status`, `POST /auth/max/link`, API contracts.

## Change boundary

Only the backend verifies and commits MAX links. The current user must be authenticated, MAX linking must use fresh launch data from inside MAX, and link status must expose only a boolean. Do not put passwords or raw platform identity values in the page or browser storage.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
