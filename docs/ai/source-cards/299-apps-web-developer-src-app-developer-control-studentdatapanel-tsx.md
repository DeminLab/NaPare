# Source card: `apps/web-developer/src/app/(developer)/control/StudentDataPanel.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/control/StudentDataPanel.tsx`

## Scope

Developer UI for searching and correcting attendance and absence records, plus reviewing and correcting absence-confirmation decisions.

## Change boundary

Use explicit reasons and show only actions allowed by the current `student-data.read/write` access profile. Preserve the associated curator on decision corrections; the backend remains authoritative.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
