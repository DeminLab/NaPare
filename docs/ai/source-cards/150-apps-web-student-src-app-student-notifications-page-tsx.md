# Source card: `apps/web-student/src/app/(student)/notifications/page.tsx`

## Canonical source

`apps/web-student/src/app/(student)/notifications/page.tsx`

## Scope

Account-scoped, paginated notification feed with cached loaded pages, queued offline read state, URL filters, important events and explicit read actions. Contextual lesson links and settings replace duplicate sidebar statistics. Older events load on demand; failed continuation keeps the current feed visible. The global unread total comes from the user-scoped `/notifications/unread-count` endpoint, is cached with the account feed, and is adjusted for local read actions. If the count endpoint fails, the page labels a loaded-page count as partial and does not announce that every notification is read.

An empty successful history is cacheable too: pagination metadata can validly contain `loadedPage=0` and `totalPages=0` when the API total is zero.

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
