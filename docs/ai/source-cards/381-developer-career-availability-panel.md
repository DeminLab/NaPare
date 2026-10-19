# Developer career availability panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/CareerAvailabilityPanel.tsx`

## Scope

Search and edit user career-planning availability settings across universities, including time budget, IANA time zone, weekly windows and blocked date ranges.

## Change boundary

Reads require `career-data.read`; edits require `career-data.write` and a reason. Reuse the career-planning validator and preserve the saved university association. Detail reads and edits are audited.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/web-developer exec tsc --noEmit
```
