# Source card: `apps/web-student/src/app/(student)/internal-navigation.ts`

## Canonical source

`apps/web-student/src/app/(student)/internal-navigation.ts`

## Scope

Validates notification navigation destinations so student screens only route to same-origin application paths.

## Read sequence

1. Read [the Notifications module](../../modules/notifications.md).
2. Read this helper and its callers in the student Today and Notifications routes.

## Change boundary

Reject external, protocol-relative, and backslash-containing destinations. Keep valid same-origin paths, query strings, and fragments intact.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
