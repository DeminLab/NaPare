# Source card: apps/backend/test/career-moderation.e2e-spec.ts

## Canonical source

`apps/backend/test/career-moderation.e2e-spec.ts`

## Scope

Real JWT/HTTP/PostgreSQL scenarios for moderation, complaints, concurrency, privacy, rollback and tenant isolation. Read the [moderation contract](../../modules/career-moderation.md) before changing behavior. Preserve university isolation and existing work/payment state; a complaint alone does not suspend a task.

## Verification

Run affected backend/portal typechecks, risk-policy unit tests, disposable PostgreSQL moderation E2E, role matrix and repository documentation/boundary/lint checks. Browser verification uses the real local API; distinguish local results from CI and production. Never use production data for fixtures.
