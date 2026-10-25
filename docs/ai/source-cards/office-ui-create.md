# Academic office: office-ui-create

## Canonical source

`apps/web-admin/src/app/(admin)/requests/CreateRequest.tsx`

## Scope

Explicit operator-on-behalf submission with group/student selection and stable creation idempotency key.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
