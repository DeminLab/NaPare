# Source card: `packages/ui/src/index.tsx`

## Canonical source

`packages/ui/src/index.tsx`

## Scope

Shared UI primitives. EmptyState uses semantic `ds-empty` classes and a compact wrapping layout; description and action remain optional. Consumers include role workspaces and explicitly migrated student routes. Keep component prop contracts and native accessibility semantics intact.

Primary and danger buttons use semantic foreground colors (`--color-on-brand`, `--color-on-danger`) so bright dark-theme actions retain readable text. Loading buttons preserve their action label and expose `aria-busy`; the decorative spinner is hidden from the accessibility tree. Student settings and affected student routes use the shared button, preserving the existing props API.

`TabBar` implements manual-activation tabs: one roving tab stop, RTL-aware ArrowLeft/ArrowRight and Home/End focus movement, and optional `idPrefix`/`ariaLabel` for an explicit `tabpanel` relationship. Consumers provide a matching panel ID and `aria-labelledby`; only the staff lesson workspace currently uses this shared primitive.

## Read sequence

Read AI_CONTEXT.md, this module, `packages/design-tokens/styles.css` and the affected consumer. Student local primitives are separate and must not be assumed to inherit shared React markup.

## Verification

Run TypeScript for affected web applications, repository lint and browser checks of empty and populated pages. For `TabBar`, verify keyboard movement, selected-versus-focused behavior, tab/panel ID relationships and responsive overflow in the consumer.
