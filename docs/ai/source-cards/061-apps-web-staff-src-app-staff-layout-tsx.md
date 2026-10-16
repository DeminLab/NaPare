# Source card: `apps/web-staff/src/app/(staff)/layout.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/layout.tsx`

## Scope

Staff workspace uses actual teacher/curator/dean/department-head labels, grouped navigation, one search and mobile shortcuts. The absence queue link is shown to reviewer roles. Tutorial help is no longer promoted in this workspace. Page density styles are scoped to role-content; personal connections route to the portal.

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

