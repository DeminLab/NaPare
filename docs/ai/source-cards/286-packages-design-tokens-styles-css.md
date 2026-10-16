# Source card: `packages/design-tokens/styles.css`

## Canonical source

`packages/design-tokens/styles.css`

## Scope

Shared primitive and semantic tokens and base UI styles, including compact empty states. Content-scoped role and curation presentation lives in `packages/ui/content-styles.css`, imported by role app globals. Keep page-specific classes out of this token sheet.

## Read sequence

Read AI_CONTEXT.md, this stylesheet, role globals and the direct page/component using the affected class. Check role accents, custom student themes and the dark developer shell before modifying colors.

## Verification

Run affected app TypeScript, root lint and guards; inspect responsive pages in the browser. CSS validation alone does not establish visual quality or deployment.
