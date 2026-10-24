# Source card: request parser regressions

## Canonical source

`apps/backend/test/request-parser.e2e-spec.ts`

## Scope

Child-process tests of the actual Nest-resolved Express, body-parser and multer packages. Covers JSON compression, multipart compatibility and late parser errors without allowing a vulnerable parser to crash Jest. Read the [dated patch report](../../security/request-parser-patch-2026-10-24.md). Fixtures listen only on an ephemeral loopback port and use synthetic bodies.

## Verification

Run `pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand request-parser.e2e-spec.ts`, root lint/docs guards and production audit. Local reproduction is not deployment or external-service proof.
