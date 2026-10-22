# Academic office: office-ui-settings

## Canonical source

`apps/web-admin/src/app/(admin)/requests/OfficeSettings.tsx`

## Scope

Assignments and versioned group routes; empty scope is explicitly no access. Search requests are cancellable.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
