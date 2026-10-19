# Source card: `apps/web-student/src/app/globals.css`

## Canonical source

`apps/web-student/src/app/globals.css`

## Scope

Student workspace palette overrides, responsive content styling and appearance preferences, including light/dark palettes and accent variants. The focus ring follows the selected light accent at its 600 shade and uses the dark palette's 400 shade for contrast. Global navigation and shared shell structure live in `StudentShell` and `packages/ui/src/WorkspaceShell.tsx`.

## Read sequence

Read AI_CONTEXT.md, this stylesheet, shared design tokens, student palette preferences and the route/component using the affected token. Keep student contrast valid for each selected accent and both palettes.

## Verification

Run student TypeScript, focused ESLint, repository guards and documentation checks. Color-pair calculations are static evidence; verify the cascade, focus visibility, responsive layouts and screen reader output in a browser before claiming visual/accessibility completion.
