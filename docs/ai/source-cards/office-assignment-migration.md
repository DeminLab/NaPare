# Academic office: office-assignment-migration

## Canonical source

`apps/backend/src/migrations/1700000000031-OfficeAssignments.ts`

## Scope

Adds scoped appointments and route templates, with FORCE RLS from migration 29.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
