# Student offline source 3

## Canonical source

`apps/web-student/test/load-typescript.cjs`

## Scope

Offline schedule: bounded selected fields, account partition and cold navigation fallback; fixture tests do not prove production.

## Verification

Run `pnpm --filter @napare/web-student test:offline`, student typecheck and repository guards; browser verification is separate.
