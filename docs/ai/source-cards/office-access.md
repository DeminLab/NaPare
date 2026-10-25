# Academic office: office-access

## Canonical source

`apps/backend/src/requests/office-access.service.ts`

## Scope

Fresh group/faculty assignments, dean pointer and active curator authority. Bulk read scopes preserve student-curator appointments without enabling self-approval.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
