# Source card: `apps/web-staff/src/app/(staff)/pair-space/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/pair-space/page.tsx`

## Scope

Searchable list of role-scoped lessons from the preceding week and next two weeks. Recent and upcoming lessons lead directly to their workspaces using the existing schedule API. Loading, empty search and request failure are distinct states.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```

