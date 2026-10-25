# Source card: apps/backend/src/career-billing/payment.service.ts

## Canonical source

`apps/backend/src/career-billing/payment.service.ts`

## Scope

Durable intent transactions, company access, reconciliation and owner-only refunds.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read [T-Kassa integration](../../integrations/tkassa.md) and the canonical source.

## Verification

Run billing protocol/HTTP tests, backend and portal typechecks, and repository guards.
