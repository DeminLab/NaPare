# Source card: apps/backend/src/career-billing/tkassa.provider.ts

## Canonical source

`apps/backend/src/career-billing/tkassa.provider.ts`

## Scope

Fixed-endpoint bank transport, signing and notification authentication.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [T-Kassa integration](../../integrations/tkassa.md) and the canonical source.

## Verification

Run billing protocol/HTTP tests, backend and portal typechecks, and repository guards.
