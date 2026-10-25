# Source card: semester service

## Canonical source

`apps/backend/src/semester/semester.service.ts`

## Scope

Scoped identity mutations/audit, explicit periods and exact-user Moodle report aggregation.

## Verification

Backend typecheck, unit and E2E tests with disposable `SEMESTER_TEST_DATABASE_URL`, root guards and lint. See [semester contract](../../integrations/moodle-semester.md) for source, setup and evidence limits.
