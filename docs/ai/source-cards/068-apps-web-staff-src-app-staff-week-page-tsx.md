# Source card: `apps/web-staff/src/app/(staff)/week/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/week/page.tsx`

## Scope

Weekly time table on wide screens, selected-day list on narrower screens; optional day/agenda views, visible filters and URL restoration. Each lesson exposes direct attendance and materials links. Legacy list view resolves to the weekly agenda. Group filters accept group ID or legacy name; status uses date before time. Up to 100 lessons are requested for the week.

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


## Schedule date contract

The lesson day comes from startDate/date, with ISO startTime only as a legacy fallback. HH:mm startTime must not be used as a date. Regression check: `node scripts/test-staff-week.cjs`.
