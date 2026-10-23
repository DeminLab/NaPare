# Account data transport

## Canonical source

`apps/web-portal/src/app/privacy/account/api.ts`

## Scope

No-store bearer requests, guarded token refresh for reads only, session-change protection and scoped offline-cache cleanup. Read [account controls](../../privacy/account-controls.md), [deletion contract](../../privacy/account-deletion.md) and [export contract](../../privacy/personal-data-export.md) before changing this source. Preserve shared headers, navigation and student source boundaries.

## Verification

Portal typecheck, root lint and repository guards. Browser verification uses disposable synthetic accounts with real local Next/Nest/PostgreSQL; test current-account identity, errors, retained archive, JSON completeness and local cleanup separately from remote/device copies.
