# Source card: webpush-policy-tests

## Canonical source

`apps/backend/src/notifications/webpush-policy.spec.ts`

## Scope

Configuration, matching key pairs, subject restrictions, disabled sending and current/unrevoked consent. Test keys are ephemeral; no provider is contacted. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
