# Source card: device-token-entity

## Canonical source

`apps/backend/src/notifications/entities/device-token.entity.ts`

## Scope

Opaque provider token ownership and current opt-in/revocation metadata. Raw tokens/keys are excluded from personal exports; own consent dates/version are included. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
