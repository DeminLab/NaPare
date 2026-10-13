# Source card: `apps/web-staff/src/app/(staff)/today/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/today/page.tsx`

## Scope

Daily role workspace uses actual open inbox items for attention counts instead of summed absences and schedule changes. Curator, dean, department head and administrators get a role-labelled queue/group panel. Notice bodies use the API body field.

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

