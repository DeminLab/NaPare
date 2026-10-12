# Source card: `apps/web-staff/src/app/(staff)/StaffSpotlight.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/StaffSpotlight.tsx`

## Scope

Legacy staff Spotlight retained as source but no longer mounted. Active staff search is provided by WorkspaceShell with the existing scoped search endpoint.

## Read sequence

1. Read [the Search module](../../modules/search.md).
2. Read this component and the staff API helper.
3. Follow the staff layout where the panel is mounted.

## Change boundary

Keep results limited to the authenticated API response, preserve the teacher scope enforced by the backend and use the staff Pair Space route.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```
