# Academic office: office-ui-types

## Canonical source

`apps/web-admin/src/app/(admin)/requests/types.ts`

## Scope

Typed office DTO projection and Russian UI labels without importing backend implementation into the client bundle.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
