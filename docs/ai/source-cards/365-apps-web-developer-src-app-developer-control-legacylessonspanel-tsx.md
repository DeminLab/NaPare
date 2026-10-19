# Source card: Developer legacy lessons panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/LegacyLessonsPanel.tsx`

## Scope

Searches legacy lessons, shows their academic links and history, and edits manual records with a required reason.

## Change boundary

Preserve linked group, teacher, course, and series identifiers; imported lessons remain read-only.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
