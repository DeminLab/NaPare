# Source card: `apps/web-staff/src/app/(staff)/attendance/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/attendance/page.tsx`

## Scope

Attendance journal saves only explicitly marked students. While existing marks load, the roster cannot be edited or saved; stale requests are ignored after changing the lesson. Unsaved changes are confirmed before internal links, same-document history traversal through the Navigation API or the staff layout's tracked `popstate` fallback, and the staff search's programmatic navigation. The fallback restores a cancelled traversal with inverse `history.go(delta)` and preserves the forward branch. Navigation is blocked with an explanation while a save request is in progress. Failed attendance POST requests keep the roster and retry action visible, with their own inline alert. Unmarked rows are not silently recorded as present; batch actions and individual controls remain available. The percentage counts marked students. Teacher records present, absent or late in the group roster. QR generation is no longer exposed. Existing scoped group, lesson and absence APIs are preserved.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Use the browser's local calendar date for the date input and send that local day's UTC start/end timestamps when loading lessons. Preserve server-side teacher ownership, group and tenant checks.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
pnpm exec eslint "apps/web-staff/src/app/(staff)/attendance/page.tsx" "apps/web-staff/src/app/(staff)/StaffSpotlight.tsx"
```

Synthetic browser confirmed the test roster, cancellation of a dirty internal link, date change, search navigation, same-document Back/Forward history index retention, a delayed POST navigation block, and a failed POST that keeps the roster and retry visible; a subsequent mock success clears dirty state. Cancel/accept through native browser dialogs, multiple group/lesson options, browser fallback behavior without the Navigation API, screen reader, and actual backend/API writes remain unverified. A local synthetic API session is not production authorization evidence.

