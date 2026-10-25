# Account data controller

## Canonical source

`apps/web-portal/src/app/privacy/account/AccountDataControls.tsx`

## Scope

Authenticated profile/preview loading, verified complete JSON download, explicit erasure receipt and matching-session cleanup. Read [account controls](../../privacy/account-controls.md), [deletion contract](../../privacy/account-deletion.md) and [export contract](../../privacy/personal-data-export.md) before changing this source. Preserve shared headers, navigation and student source boundaries.

## Verification

Deletion receipts distinguish confirmed server deletion from partial local cache/push cleanup. Preserve the new-session guard.

Portal typecheck, root lint and repository guards. Browser verification uses disposable synthetic accounts with real local Next/Nest/PostgreSQL; test current-account identity, errors, retained archive, JSON completeness and local cleanup separately from remote/device copies.
