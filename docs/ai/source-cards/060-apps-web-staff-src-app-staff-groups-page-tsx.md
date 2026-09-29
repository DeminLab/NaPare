# Source card: `apps/web-staff/src/app/(staff)/groups/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/groups/page.tsx`

## Scope

Staff group overview and its data flow; its current-week schedule fetch includes Monday through Sunday and formats API dates in local calendar time.

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

