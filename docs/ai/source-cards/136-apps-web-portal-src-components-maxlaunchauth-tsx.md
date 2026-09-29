# Source card: `apps/web-portal/src/components/MaxLaunchAuth.tsx`

## Canonical source

`apps/web-portal/src/components/MaxLaunchAuth.tsx`

## Scope

MAX launch handling has two modes. The public landing uses `captureOnly` to remove fragment launch data from the URL/history entry and retain it only in page memory, without authenticating or showing UI. The login page waits up to 15 seconds for Bridge data, consumes the retained payload or falls back to the MAX `WebAppData` fragment, then submits it to `/auth/max`. An already-linked MAX identity wins over a stale or different local site session. For an unlinked identity, detect/refresh an existing site session, show its name and email, and offer an explicit link action through `/auth/max/link`, or accept university-issued credentials through `/auth`. Persist the returned standard JWT pair and route to the workspace matching the backend role. Transient errors can be retried; invalid or expired launch data asks the user to reopen from MAX.

## Read sequence

1. Read [MAX client flow](../../clients/max-miniapp.md) and the auth module.
2. Read this component and both callers: `apps/web-portal/src/app/page.tsx` (capture only) and `apps/web-portal/src/app/login/page.tsx` (explicit login).
3. Follow server validation in `apps/backend/src/auth/auth.service.ts` and `max-init-data.ts`.

## Change boundary

Never trust MAX launch data on the client, persist raw initData beyond the current page memory, or persist the first-link password. Remove launch data from the URL as soon as it is captured. Only route based on a role returned by the backend. Opening the public landing must not authenticate or show the link flow; that begins only after the user opens `/login`.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
