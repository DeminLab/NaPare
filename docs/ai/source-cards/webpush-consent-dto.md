# Source card: webpush-consent-dto

## Canonical source

`apps/backend/src/notifications/dto/webpush-consent.dto.ts`

## Scope

Bounded serialized subscription, explicit confirmation and exact opt-in version; a separate token-only DTO permits withdrawal without granting consent. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
