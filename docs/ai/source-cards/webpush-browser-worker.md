# Source card: webpush-browser-worker

## Canonical source

`apps/web-portal/public/notifications/push-worker.js`

## Scope

Separate /notifications/ worker scope. Always shows neutral text, ignores payload URLs and private text, has no fetch/cache handler and opens only the fixed same-origin setup page. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
