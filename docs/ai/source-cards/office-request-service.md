# Academic office: office-request-service

## Canonical source

`apps/backend/src/requests/request.service.ts`

## Scope

Tenant-scoped queues, routes, idempotent commands, durable decisions, explicit operator submission and debt-source empty state.

## Verification

Run office HTTP tests with a disposable `OFFICE_TEST_DATABASE_URL`, backend/admin typechecks, lint and repository guards. Browser and production evidence are separate; see [module guide](../../modules/academic-office.md).
