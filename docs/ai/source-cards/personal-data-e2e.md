# Self export PostgreSQL tests

## Canonical source

`apps/backend/test/personal-data.e2e-spec.ts`

## Scope

Real Nest/JWT/HTTP and PostgreSQL RLS tests with synthetic data. New local disposable curation_test database required; never use a shared or production database.

## Verification

Set PERSONAL_DATA_TEST_DATABASE_URL to the disposable runtime-role database and run this E2E suite. No external Moodle or provider access is needed.
