# Academic office: office-request-entities

## Canonical source

`apps/backend/src/requests/request.entities.ts`

## Scope

Six tenant entities for appointments, group routes, requests, steps, immutable decisions and existing document references. Explicit PostgreSQL column types.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
