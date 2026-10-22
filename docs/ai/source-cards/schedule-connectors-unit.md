# Source card: Fixture CSV/ICS, XLSX, timezone and source identity regression tests

## Canonical source

`apps/backend/src/schedule/connectors/file-schedule-connectors.spec.ts`

## Scope

Fixture CSV/ICS, XLSX, timezone and source identity regression tests. See [university import reference](../../integrations/schedule-import.md).

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read the canonical source and its direct imports.

## Verification

Run focused adapter tests, schedule-import HTTP tests with a disposable local database, backend typecheck and repository guards.
