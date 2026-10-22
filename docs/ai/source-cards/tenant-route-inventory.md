# Source card: scripts/security-route-inventory.cjs

## Canonical source

`scripts/security-route-inventory.cjs`

## Scope

TypeScript AST route inventory; regenerate tenant isolation table and reject stale snapshots.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read the canonical source and direct dependencies.

## Verification

Run focused backend tests, backend typecheck, and repository guards.
