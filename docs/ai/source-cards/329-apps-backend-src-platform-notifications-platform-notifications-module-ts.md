# Source card: Platform notifications module

## Canonical source

`apps/backend/src/platform-notifications/platform-notifications.module.ts`

## Scope

Registers the platform notifications controller and service with notification, inbox, push-device, user, university, and audit repositories.

## Change boundary

Keep administration scoped to notification and inbox records and their required audit context.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
