# Source card: `packages/ui/content-styles.css`

## Canonical source

`packages/ui/content-styles.css`

## Scope

Shared content presentation for the student, staff, university and developer applications. The stylesheet is exported by `@napare/ui/content-styles.css` and imported in each app's globals. Most selectors stay inside `.student-content` and `.role-content`; curation classes style only their own component. Shell navigation, avatars and header implementations are outside this scope.

Curation controls use semantic colors. Mobile group selection uses a native select; desktop uses a list. Tabs must fit at 320 px. Forms retain 44px controls and visible focus indicators.

## Read sequence

Read AI_CONTEXT.md, this stylesheet, relevant role globals, Curation.tsx and the affected page. Check both student appearance settings and the developer dark shell when changing colors.

## Verification

Run role TypeScript, root lint and guards. Verify actual CSS compilation and responsive rendering in a browser; TypeScript does not check stylesheets.
