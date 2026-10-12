# Source card: `apps/web-student/src/app/(student)/StudentSpotlight.tsx`

## Canonical source

`apps/web-student/src/app/(student)/StudentSpotlight.tsx`

## Scope

Legacy student Spotlight retained as source but no longer mounted. Active student search is provided by WorkspaceShell and the role-scoped search adapter in StudentShell.

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
