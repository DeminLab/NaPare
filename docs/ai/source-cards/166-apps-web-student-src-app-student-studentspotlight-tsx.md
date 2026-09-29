# Source card: `apps/web-student/src/app/(student)/StudentSpotlight.tsx`

## Canonical source

`apps/web-student/src/app/(student)/StudentSpotlight.tsx`

## Scope

Student global search command panel, keyboard navigation, debounced API calls and Pair Space navigation.

## Read sequence

1. Read [the Search module](../../modules/search.md).
2. Read this component and the student API helper.
3. Follow the student layout where the panel is mounted.

## Change boundary

Keep search results limited to the authenticated API response and preserve keyboard and focus behavior.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
