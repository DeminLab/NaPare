# Source card: Platform notifications DTOs

## Canonical source

`apps/backend/src/platform-notifications/platform-notifications.dto.ts`

## Scope

Validates notification/inbox search filters and type-specific correction fields, plus push-device search filters and the required reason for edits or revocation.

## Change boundary

Keep allowed kinds, statuses, and field limits aligned with each record type. Do not let notification-only fields mutate inbox records or vice versa.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
