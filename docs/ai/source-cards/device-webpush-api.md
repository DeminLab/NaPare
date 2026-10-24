# Source card: device-webpush-api

## Canonical source

`apps/backend/src/notifications/devices.controller.ts`

## Scope

Existing token contracts plus exact self GET/POST/DELETE /devices/webpush routes. Strict service ownership and durable consent are required for actual WebPush delivery. Read the [WebPush client contract](../../clients/webpush.md).

## Verification

Run focused WebPush unit/HTTP/PostgreSQL tests, affected backend/portal typechecks, role baseline, repository lint/docs guards and browser scenarios. Synthetic/mock evidence must not be presented as live device delivery or production proof.
