# Source card: semester migration

## Canonical source

`apps/backend/src/migrations/1700000000036-AcademicIdentities.ts`

## Scope

Identity table, references, uniqueness and restrictive FORCE RLS.

## Verification

Backend typecheck, unit and E2E tests with disposable `SEMESTER_TEST_DATABASE_URL`, root guards and lint. See [semester contract](../../integrations/moodle-semester.md) for source, setup and evidence limits.

