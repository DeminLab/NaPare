# Source card: `packages/design-tokens/styles.css`

## Canonical source

`packages/design-tokens/styles.css`

## Scope

Shared primitive and semantic tokens and base UI styles, including compact empty states. `--color-control-border` is reserved for controls and stays more visible than decorative `--color-border`; `--color-focus-ring` separates focus visibility from brand-soft surfaces. Content-scoped role and curation presentation lives in `packages/ui/content-styles.css`, imported by role app globals. Keep page-specific classes out of this token sheet.

Base spacing tokens are defined here for shared React role apps; app globals should add role accents and workspace aliases without redefining the same spacing scale.

## Read sequence

Read AI_CONTEXT.md, this stylesheet, role globals and the direct page/component using the affected class. Check role accents, custom student themes and the dark developer shell before modifying colors. Normal muted text must meet 4.5:1; visible control boundaries and focus indicators must meet 3:1 against adjacent colors. Check semantic foregrounds against soft fills in every theme.

## Verification

Run affected app TypeScript, root lint and guards; inspect responsive pages in the browser. CSS validation alone does not establish visual quality or deployment.
