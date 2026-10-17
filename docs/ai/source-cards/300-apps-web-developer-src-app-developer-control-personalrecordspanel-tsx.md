# Source card: `apps/web-developer/src/app/(developer)/control/PersonalRecordsPanel.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/control/PersonalRecordsPanel.tsx`

## Scope

Developer UI for inspecting and editing user notification preferences, favorites, personal lesson notes, and homework progress.

## Change boundary

Show read/write capabilities separately, require a reason for writes, and never surface credentials or private notification contents.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
