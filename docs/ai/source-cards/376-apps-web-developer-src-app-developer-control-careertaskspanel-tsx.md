# Source card: `apps/web-developer/src/app/(developer)/control/CareerTasksPanel.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/control/CareerTasksPanel.tsx`

## Scope

Global career task search, audited detail reads, and reasoned editing for eligible draft tasks.

## Change boundary

The API permits edits only while a task remains a draft with no applications or work rows. Company and university links are not editable; the server rechecks task state, relations, partnership and field constraints inside a transaction.

## Verification

Run backend/developer TypeScript checks, root lint, documentation lint and repository guards. Database and browser checks require a running disposable local environment.
