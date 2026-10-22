# Source card: semester identity

## Canonical source

`apps/backend/src/semester/academic-identity.entity.ts`

## Scope

Persisted university/student/source-bound numeric Moodle identity with unique constraints.

## Verification

Backend typecheck, unit and E2E tests with disposable `SEMESTER_TEST_DATABASE_URL`, root guards and lint. See [semester contract](../../integrations/moodle-semester.md) for source, setup and evidence limits.

