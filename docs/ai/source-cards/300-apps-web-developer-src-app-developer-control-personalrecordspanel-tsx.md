# Source card: `apps/web-developer/src/app/(developer)/control/PersonalRecordsPanel.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/control/PersonalRecordsPanel.tsx`

## Scope

Developer UI for inspecting and editing user notification preferences, favorites, personal lesson notes, and homework progress.

## Change boundary

Show read/write capabilities separately, require a reason for writes, and never surface credentials or private notification contents. Resolve university labels from the existing university endpoint only when `universities.read` is granted; otherwise use the selected user's current university only when its ID matches. Do not render raw university UUIDs as labels or bypass the grant to fetch names.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
