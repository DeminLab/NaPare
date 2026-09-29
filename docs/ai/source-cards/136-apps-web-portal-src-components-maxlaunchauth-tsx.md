# Source card: `apps/web-portal/src/components/MaxLaunchAuth.tsx`

## Canonical source

`apps/web-portal/src/components/MaxLaunchAuth.tsx`

## Scope

MAX Bridge launch handling on the public portal: wait up to 15 seconds for Bridge data, fall back to the MAX `WebAppData` URL fragment when the Bridge CDN is unavailable, immediately remove fragment launch data from the URL/history entry while retaining it only in page memory, retry current Bridge data or the retained launch string after a transient authentication error, and ask the user to reopen from the MAX bot when the server rejects the launch data as invalid or expired. Submit the launch string to `/auth/max` first so an already-linked MAX identity wins over a stale or different local site session. For an unlinked MAX identity, detect/refresh an existing site session, show its name and email, and offer an explicit link action through `/auth/max/link`, or accept university-issued credentials through `/auth`. Persist the returned standard JWT pair and route to the workspace matching the backend role.

## Read sequence

1. Read [MAX client flow](../../clients/max-miniapp.md) and the auth module.
2. Read this component and its caller `apps/web-portal/src/app/page.tsx`.
3. Follow server validation in `apps/backend/src/auth/auth.service.ts` and `max-init-data.ts`.

## Change boundary

Never trust MAX launch data on the client, persist raw initData, or persist the first-link password. Remove launch data from the URL as soon as it is captured. Only route based on a role returned by the backend. Keep the regular public landing visible when MAX Bridge launch data is absent.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```
