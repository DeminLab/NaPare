# Source card: `apps/web-admin/src/app/(admin)/layout.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/layout.tsx`

## Scope

University workspace uses grouped navigation for overview, schedule, users, structure and data sources; removes the unused analytics query route, adds mobile shortcuts and role help.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-admin exec tsc --noEmit
```

