# Source card: `apps/web-staff/src/app/(staff)/attendance/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/attendance/page.tsx`

## Scope

Attendance journal saves only explicitly marked students. Unmarked rows are not silently recorded as present; batch actions and individual controls remain available. The percentage counts marked students. Existing scoped group, lesson, QR and absence APIs are preserved.

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

