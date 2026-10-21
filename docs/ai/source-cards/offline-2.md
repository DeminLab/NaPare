# Student offline source 2

## Canonical source

`apps/web-student/src/app/(student)/offline-schedule.ts`

## Scope

Offline schedule: bounded selected fields, account partition and cold navigation fallback; fixture tests do not prove production.

## Verification

Run `pnpm --filter @napare/web-student test:offline`, student typecheck and repository guards; browser verification is separate.
