# Source card: `apps/web-student/src/app/(student)/favorite-api.ts`

## Canonical source

`apps/web-student/src/app/(student)/favorite-api.ts`

## Scope

Student route helper for authenticated account-level favorite list/create/delete requests, using the existing API client's access-token refresh behavior and a per-account offline mutation queue retried when connectivity returns.

## Read sequence

1. Read this client and the favorite controller contract in [the Schedule module](../../modules/schedule.md).
2. Follow calls from the Student groups and weekly schedule pages.

## Change boundary

Use the existing auth refresh path and keep favorite reads/writes bound to `/users/me`.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
