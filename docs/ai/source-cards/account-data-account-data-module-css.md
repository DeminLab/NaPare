# Account data styles

## Canonical source

`apps/web-portal/src/app/privacy/account/account-data.module.css`

## Scope

Responsive account controls, visible focus, wrapped account codes and destructive form styling. Read [account controls](../../privacy/account-controls.md), [deletion contract](../../privacy/account-deletion.md) and [export contract](../../privacy/personal-data-export.md) before changing this source. Preserve shared headers, navigation and student source boundaries.

## Verification

Portal typecheck, root lint and repository guards. Browser verification uses disposable synthetic accounts with real local Next/Nest/PostgreSQL; test current-account identity, errors, retained archive, JSON completeness and local cleanup separately from remote/device copies.
