# Source card: `packages/ui/src/LessonTypeBadge.tsx`

## Canonical source

`packages/ui/src/LessonTypeBadge.tsx`

## Scope

Shared accessible lesson-type label for student, staff, admin and curation schedules. It recognizes English types and Russian SIBIT abbreviations such as `лек`, `практ` and `лаб`. Lecture uses blue, practice uses green, laboratory uses amber; unknown and other lesson types use neutral colors. Text labels remain visible so color is not the only signal. Colors come from shared design tokens, with dark values for system themes and the student appearance palette.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md) and [shared UI primitives](285-packages-ui-src-index-tsx.md).
2. Read this component and `packages/ui/content-styles.css`.
3. Check callers in the student, staff, admin and curation schedule cards.

## Change boundary

Keep recognized type labels consistent, preserve visible text and neutral fallbacks, and use semantic design tokens that retain contrast in light and dark system themes.

## Verification

```powershell
pnpm --filter @napare/ui exec tsc --noEmit
pnpm lint
```
