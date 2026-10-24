# Source card: webpush-worker-tests

## Canonical source

`apps/backend/src/notifications/webpush-worker.spec.ts`

## Scope

Runs the actual portal worker script in a VM with mocked browser notification/client APIs. Checks neutral text, malformed payloads, fixed same-origin navigation and absence of fetch interception; no native display proof. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
