# Academic office: office-http-tests

## Canonical source

`apps/backend/test/requests.e2e-spec.ts`

## Scope

Disposable real PostgreSQL/JWT/HTTP coverage of tenants, faculties, revocation, concurrent and replayed commands, curator identity and dispatcher boundaries.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
