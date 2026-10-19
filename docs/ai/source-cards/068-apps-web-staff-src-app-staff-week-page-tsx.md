# Source card: `apps/web-staff/src/app/(staff)/week/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/week/page.tsx`

## Scope

Weekly readable day panels on all screens; optional selected-day, agenda and horizontally scrollable time-table views, visible filters and URL restoration. The view switcher and day selector expose named semantic groups with pressed states. A native date field jumps directly to any calendar date and updates the displayed week. Request-sequence protection prevents an older week response from replacing a newer selection. Lesson titles use 16px text; group, room and shared color-coded type badges are separate lines. The optional table keeps wide day columns and a sticky time column. Each lesson exposes direct attendance and materials links. Legacy list view resolves to the weekly agenda. Group filters accept group ID or legacy name; status uses date before time. Up to 100 lessons are requested for the week.

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

The lesson day comes from startDate/date, with ISO startTime only as a legacy fallback. HH:mm startTime must not be used as a date. Regression check: `node scripts/test-staff-week.cjs`. The date picker updates week and selected date without a redundant schedule request when the date stays in the current week; stale requests cannot replace current lessons, error or loading state.

## Recent browser evidence

On 2026-10-18, local Playwright with synthetic teacher/session and schedule responses verified a deep link to 2026-10-20, a date-field change to 2026-11-04, the matching displayed week ranges, and no document overflow at 320/768/1024/1440px. Auxiliary unread-count and curation requests were also mocked; console errors were 0 after setup. This does not verify backend authorization/data, error/retry states, delayed-response ordering, all view/filter combinations, export, or offline behavior.
