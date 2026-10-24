# Academic office: office-ui-dispatch

## Canonical source

`apps/web-admin/src/app/(admin)/requests/DispatcherWorkspace.tsx`

## Scope

Scoped saved-lesson schedule and time/room edits through the existing schedule API. Source/group/teacher identities remain server-protected.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
