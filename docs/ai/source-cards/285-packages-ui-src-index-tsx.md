# Source card: `packages/ui/src/index.tsx`

## Canonical source

`packages/ui/src/index.tsx`

## Scope

Shared UI primitives. EmptyState uses semantic `ds-empty` classes and a compact wrapping layout; description and action remain optional. Consumers include role workspaces and explicitly migrated student routes. Keep component prop contracts and native accessibility semantics intact.

Primary and danger buttons use semantic foreground colors (`--color-on-brand`, `--color-on-danger`) so bright dark-theme actions retain readable text. Student settings and affected student routes use the shared button, preserving the existing props API.

## Read sequence

Read AI_CONTEXT.md, this module, `packages/design-tokens/styles.css` and the affected consumer. Student local primitives are separate and must not be assumed to inherit shared React markup.

## Verification

Run TypeScript for affected web applications, repository lint and browser checks of empty and populated pages.
