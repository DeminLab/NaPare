# Source card: semester http-tests

## Canonical source

`apps/backend/test/semester.e2e-spec.ts`

## Scope

Real HTTP/JWT/PostgreSQL migration, tenant isolation and source/revocation scenarios.

## Verification

Backend typecheck, unit and E2E tests with disposable `SEMESTER_TEST_DATABASE_URL`, root guards and lint. See [semester contract](../../integrations/moodle-semester.md) for source, setup and evidence limits.

