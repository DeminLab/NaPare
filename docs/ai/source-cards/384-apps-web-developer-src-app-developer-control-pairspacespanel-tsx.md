# Source card: Developer PairSpace panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/PairSpacesPanel.tsx`

## Scope

Search and inspect PairSpace tenant/catalog relationships and related-record counts; allow reasoned active-state changes only when the current platform permission allows it.

## Change boundary

Display schedule-derived values as read-only. The backend remains authoritative for authorization, relationship validation, and audit.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
