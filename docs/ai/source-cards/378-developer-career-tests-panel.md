# Developer career tests panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/CareerTestsPanel.tsx`

## Scope

Search career test definitions and student attempts across universities. The test detail exposes answer keys only through an audited API read, and the editor preserves question history after attempts exist.

## Change boundary

Search and reads require `career-data.read`; edits require `career-data.write` and a reason. Do not expose answer keys in list responses or attempt rows. Do not edit questions once attempts exist.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/web-developer exec tsc --noEmit
```
