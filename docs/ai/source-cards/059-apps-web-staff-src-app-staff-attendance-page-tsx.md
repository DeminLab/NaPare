# Source card: `apps/web-staff/src/app/(staff)/attendance/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/attendance/page.tsx`

## Scope

Staff workspace UI and its data flow.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Use the browser's local calendar date for the date input and send that local day's UTC start/end timestamps when loading lessons. Preserve server-side teacher ownership, group and tenant checks.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```

