# Source card: Developer academic catalog panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/AcademicCatalogPanel.tsx`

## Scope

Searches courses and lesson series, shows their links and history, and edits manual records with a reason.

## Change boundary

Use same-university selectors for relationships and explain that existing occurrences keep their values after a series edit.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
