# Source card: `apps/web-staff/src/app/(staff)/groups/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/groups/page.tsx`

## Scope

Staff groups use the existing role-scoped attendance-groups endpoint. Group details and students retain their resource authorization. Cards provide separate accessible actions without nested buttons and links; missing student counts are not displayed as zero.

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

