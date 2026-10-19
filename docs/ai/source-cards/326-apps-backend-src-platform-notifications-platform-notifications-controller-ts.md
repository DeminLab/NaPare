# Source card: Platform notifications controller

## Canonical source

`apps/backend/src/platform-notifications/platform-notifications.controller.ts`

## Scope

Defines routes for searching, viewing, and correcting user notification/inbox records under `/platform-notifications/records`, plus push-device search and revocation under `/platform-notifications/devices`.

## Change boundary

The controller requires authentication and passes request context to the service, where platform permissions and audit behavior are enforced. Device routes never return push tokens; revocation requires a reason.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
