# Source card: `apps/web-staff/src/app/(staff)/StaffSpotlight.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/StaffSpotlight.tsx`

## Scope

Staff global search command panel, keyboard navigation, debounced API calls and role-scoped lesson navigation.

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
