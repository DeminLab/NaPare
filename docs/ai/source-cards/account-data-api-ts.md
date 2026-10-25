# Account data transport

## Canonical source

`apps/web-portal/src/app/privacy/account/api.ts`

## Scope

No-store bearer requests, guarded token refresh for reads only, session-change protection and scoped offline-cache cleanup. Read [account controls](../../privacy/account-controls.md), [deletion contract](../../privacy/account-deletion.md) and [export contract](../../privacy/personal-data-export.md) before changing this source. Preserve shared headers, navigation and student source boundaries.

After confirmed deletion, unsubscribe only the exact `/notifications/` registration owned by `/notifications/push-worker.js`. Recheck session changes before local cleanup; report partial cleanup when unsubscribe is unconfirmed. Never unregister unrelated workers or clear a newly established session.

## Verification

The helper also supports a raw successful Response for the career report XLSX. The default JSON mode and session-change checks remain authoritative; binary consumers must check university/MIME and recheck session after reading the body.

Portal typecheck, root lint and repository guards. Browser verification uses disposable synthetic accounts with real local Next/Nest/PostgreSQL; test current-account identity, errors, retained archive, JSON completeness and local cleanup separately from remote/device copies.
