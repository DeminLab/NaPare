# Academic office: office-request-migration

## Canonical source

`apps/backend/src/migrations/1700000000032-StudentRequests.ts`

## Scope

Adds requests, stages, idempotency/history and document links, then installs FORCE RLS. Destructive down is not a production instruction.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
