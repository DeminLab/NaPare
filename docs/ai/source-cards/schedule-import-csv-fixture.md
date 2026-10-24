# Source card: Sample stable ID CSV with quoted subject and explicit local date

## Canonical source

`apps/backend/test/fixtures/schedule.csv`

## Scope

Sample stable ID CSV with quoted subject and explicit local date. See [university import reference](../../integrations/schedule-import.md).

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read the canonical source and its direct imports.

## Verification

Run focused adapter tests, schedule-import HTTP tests with a disposable local database, backend typecheck and repository guards.
