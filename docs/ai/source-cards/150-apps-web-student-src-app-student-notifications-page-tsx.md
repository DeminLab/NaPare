# Source card: `apps/web-student/src/app/(student)/notifications/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/notifications/page.tsx`

## Scope

Student notification center, including account-scoped offline snapshots, queued offline read actions synchronized on reconnect, read state, filters, internal deep links, and keyboard-accessible notification actions.

## Read sequence

1. Read [the Notifications module](../../modules/notifications.md).
2. Read this route and `apps/web-student/src/app/(student)/internal-navigation.ts`.
3. Follow notification payload creation in the backend notification service.

## Change boundary

Only navigate to validated internal destinations; preserve notification ownership and server-backed read state.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
