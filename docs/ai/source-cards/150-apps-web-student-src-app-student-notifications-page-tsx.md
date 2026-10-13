# Source card: `apps/web-student/src/app/(student)/notifications/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/notifications/page.tsx`

## Scope

Account-scoped cached notification feed with queued offline read state, URL filters, important events and explicit read actions. Contextual lesson links and settings replace duplicate sidebar statistics.

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
