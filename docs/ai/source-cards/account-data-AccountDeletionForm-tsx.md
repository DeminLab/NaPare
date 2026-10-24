# Account deletion confirmation

## Canonical source

`apps/web-portal/src/app/privacy/account/AccountDeletionForm.tsx`

## Scope

Current password and two required confirmations; retained archive disclosure and responsibility blockers. Read [account controls](../../privacy/account-controls.md), [deletion contract](../../privacy/account-deletion.md) and [export contract](../../privacy/personal-data-export.md) before changing this source. Preserve shared headers, navigation and student source boundaries.

## Verification

The disclosure includes local browser push cleanup after server confirmation; external copies remain an operator procedure.

Portal typecheck, root lint and repository guards. Browser verification uses disposable synthetic accounts with real local Next/Nest/PostgreSQL; test current-account identity, errors, retained archive, JSON completeness and local cleanup separately from remote/device copies.
