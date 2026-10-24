# Academic office: office-request-module

## Canonical source

`apps/backend/src/requests/request.module.ts`

## Scope

Registers office/request entities and services plus the report controller/service and debt snapshot entities. Read the [report contract](../../modules/academic-office-reports.md).

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
