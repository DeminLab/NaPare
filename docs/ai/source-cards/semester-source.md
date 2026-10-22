# Source card: semester source

## Canonical source

`apps/backend/src/semester/semester-source.ts`

## Scope

Explicit period validation and source grade semantics, including hidden/stale/missing.

## Verification

Backend typecheck, unit and E2E tests with disposable `SEMESTER_TEST_DATABASE_URL`, root guards and lint. See [semester contract](../../integrations/moodle-semester.md) for source, setup and evidence limits.

