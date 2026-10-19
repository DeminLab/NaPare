# Source card: Developer academic schedule panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/AcademicSchedulePanel.tsx`

## Scope

Switches between normalized occurrences and legacy lessons for global search, details, schedule history, and reasoned correction of manually managed lessons. Legacy editing is implemented in `LegacyLessonsPanel.tsx`.

## Change boundary

Keep imported occurrences read-only in the panel and require `academic-data.write` for changes.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
