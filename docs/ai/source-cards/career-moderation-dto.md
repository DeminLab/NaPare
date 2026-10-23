# Source card: apps/backend/src/career/career-moderation.dto.ts

## Canonical source

`apps/backend/src/career/career-moderation.dto.ts`

## Scope

Validated decisions, required content version, complaint categories and bounded pagination. Read the [moderation contract](../../modules/career-moderation.md) before changing behavior. Preserve university isolation and existing work/payment state; a complaint alone does not suspend a task.

## Verification

Run affected backend/portal typechecks, risk-policy unit tests, disposable PostgreSQL moderation E2E, role matrix and repository documentation/boundary/lint checks. Browser verification uses the real local API; distinguish local results from CI and production. Never use production data for fixtures.
