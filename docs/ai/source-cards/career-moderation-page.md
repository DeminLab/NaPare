# Source card: apps/web-portal/src/app/career/moderation/page.tsx

## Canonical source

`apps/web-portal/src/app/career/moderation/page.tsx`

## Scope

Shared portal moderation route metadata and content entry point; protected header/navigation remain unchanged. Read the [moderation contract](../../modules/career-moderation.md) before changing behavior. Preserve university isolation and existing work/payment state; a complaint alone does not suspend a task.

## Verification

Run affected backend/portal typechecks, risk-policy unit tests, disposable PostgreSQL moderation E2E, role matrix and repository documentation/boundary/lint checks. Browser verification uses the real local API; distinguish local results from CI and production. Never use production data for fixtures.
