# Source card: `apps/web-portal/src/components/MaxLaunchAuth.tsx`

## Canonical source

`apps/web-portal/src/components/MaxLaunchAuth.tsx`

## Scope

MAX launch handling has two modes. The public landing uses `captureOnly` to remove fragment launch data from the URL/history entry and retain it only in page memory, without authenticating or showing UI. On `/login`, the user explicitly chooses MAX; the component waits up to 15 seconds for Bridge data, consumes the retained payload or falls back to the MAX `WebAppData` fragment, then submits it to `/auth/max`. An already-linked MAX identity wins over a stale or different local site session. An unlinked identity receives a message to use email/password and link later in account connections. Successful MAX login persists the standard JWT pair and routes to the workspace matching the backend role: student, staff, admin, developer, and career (`employer`, `career_staff`, `career_admin` → `/career`). Unknown roles fail closed without storing tokens or redirecting. Transient errors can be retried; invalid or expired launch data asks the user to reopen from MAX.

## Read sequence

1. Read [MAX client flow](../../clients/max-miniapp.md) and the auth module.
2. Read this component and both callers: `apps/web-portal/src/app/page.tsx` (capture only) and `apps/web-portal/src/app/login/page.tsx` (explicit MAX choice).
3. Follow server validation in `apps/backend/src/auth/auth.service.ts` and `max-init-data.ts`.

## Change boundary

Never trust MAX launch data on the client, persist raw initData beyond the current page memory, or persist a password. Remove launch data from the URL as soon as it is captured. Only route based on a role returned by the backend. Opening the public landing must not authenticate or show the link flow. Account linking belongs on `/connections`, after a user explicitly signs in.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
pnpm exec eslint apps/web-portal/src/components/MaxLaunchAuth.tsx
```

Synthetic browser proof covered `employer` routing to `/career`; the other career mappings were statically checked. The login session did not complete because the local `/users/me` proxy was unavailable, and real MAX runtime was not tested.
