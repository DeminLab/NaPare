# Source card: Developer absence-confirmation decisions

## Canonical source

`apps/web-developer/src/app/(developer)/control/StudentDataPanel.tsx`

## Scope

Absence-confirmation view inside the developer student-data panel: search decisions, open audited detail, and correct status, comment, or confirmation time.

## Change boundary

Use the existing `student-data.read/write` permissions. Require a reason for corrections and preserve the original `curatorId` association.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
