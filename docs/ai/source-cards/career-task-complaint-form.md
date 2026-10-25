# Source card: apps/web-portal/src/app/career/TaskComplaintForm.tsx

## Canonical source

`apps/web-portal/src/app/career/TaskComplaintForm.tsx`

## Scope

Student complaint form and lazy private task history with loading, error and resolution states. Read the [moderation contract](../../modules/career-moderation.md) before changing behavior. Preserve university isolation and existing work/payment state; a complaint alone does not suspend a task.

## Verification

Run affected backend/portal typechecks, risk-policy unit tests, disposable PostgreSQL moderation E2E, role matrix and repository documentation/boundary/lint checks. Browser verification uses the real local API; distinguish local results from CI and production. Never use production data for fixtures.
